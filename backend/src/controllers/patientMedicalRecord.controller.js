const pool = require("../config/db");
const { FILE_TYPES, resolveStoredPath, extOfStored } = require("../utils/labResultFile");

// C6-11 — Bệnh nhân xem lại lịch sử khám của CHÍNH MÌNH (UC-037).
// Chỉ ĐỌC. Không sửa flow đặt lịch / check-in / khám / xét nghiệm / đóng hồ sơ.
//
// Quy tắc bắt buộc (enforce ở Backend, không dựa vào frontend):
//  1. Bệnh nhân luôn được xác định từ tài khoản đăng nhập: BenhNhan.tai_khoan_id = req.user.id.
//  2. Chỉ hồ sơ của chính bệnh nhân đó (HoSoBenhAn.benh_nhan_id = id bệnh nhân).
//  3. Chỉ hồ sơ đã hoàn tất: HoSoBenhAn.trang_thai = 'DA_XONG'.
//  4. Hồ sơ của người khác, hồ sơ chưa xong và hồ sơ không tồn tại đều trả CÙNG một lỗi 404
//     để không lộ việc hồ sơ đó có tồn tại hay không.
//  5. Không trả đường dẫn file thật trên đĩa; file chỉ mở qua API có xác thực bên dưới.

const ROLE_BENH_NHAN = "Bệnh nhân";
const HS_DA_XONG = "DA_XONG";
const CD_DA_XONG = "DA_XONG";
const INT_MAX = 2147483647;
const NOT_FOUND_MSG = "Không tìm thấy hồ sơ khám";

const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

// Trả id BenhNhan của tài khoản đang đăng nhập, hoặc null (đã tự trả lỗi 403).
const loadPatientId = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BENH_NHAN) {
    fail(res, 403, "Chỉ bệnh nhân mới xem được lịch sử khám của mình");
    return null;
  }
  const r = await pool.query(`SELECT id FROM "BenhNhan" WHERE tai_khoan_id = $1`, [req.user.id]);
  if (r.rowCount === 0) {
    fail(res, 403, "Tài khoản chưa gắn với hồ sơ bệnh nhân");
    return null;
  }
  return r.rows[0].id;
};

// Bác sĩ phụ trách: HoSoBenhAn.bac_si_id, nếu NULL thì HangDoi.bac_si_id (cùng quy tắc C4/C5).
// Chuyên khoa: theo phòng khám của lượt khám; nếu không có thì theo chuyên khoa của bác sĩ.
const RECORD_FROM = `
  FROM "HoSoBenhAn" hs
  LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
  LEFT JOIN "BacSi" bs ON bs.id = COALESCE(hs.bac_si_id, h.bac_si_id)
  LEFT JOIN "PhongKham" pk ON pk.id = h.phong_kham_id
  LEFT JOIN "ChuyenKhoa" ck ON ck.id = COALESCE(pk.chuyen_khoa_id, bs.chuyen_khoa_id)`;

const toDoctor = (r) => (r.bs_id ? { id: r.bs_id, ho_ten: r.bs_ho_ten, cap_bac: r.cap_bac } : null);

// GET /api/patient/medical-records
// Danh sách lần khám đã hoàn tất của bệnh nhân đang đăng nhập, mới nhất trước. Không có -> [].
const listMedicalRecords = async (req, res) => {
  try {
    const bnId = await loadPatientId(req, res);
    if (!bnId) return;

    const r = await pool.query(
      `SELECT hs.id AS ho_so_id, to_char(hs.ngay_kham, 'YYYY-MM-DD') AS ngay_kham,
              bs.id AS bs_id, bs.ho_ten AS bs_ho_ten, bs.cap_bac,
              ck.id AS ck_id, ck.ten_chuyen_khoa,
              (SELECT COUNT(*)::int FROM "ChiDinhXetNghiem" c WHERE c.ho_so_id = hs.id) AS so_xet_nghiem
       ${RECORD_FROM}
       WHERE hs.benh_nhan_id = $1 AND hs.trang_thai = $2
       ORDER BY hs.ngay_kham DESC NULLS LAST, hs.id DESC`,
      [bnId, HS_DA_XONG]
    );

    return res.json({
      success: true,
      data: r.rows.map((x) => ({
        ho_so_id: x.ho_so_id,
        ngay_kham: x.ngay_kham,
        doctor: toDoctor(x),
        chuyen_khoa: x.ck_id ? { id: x.ck_id, ten_chuyen_khoa: x.ten_chuyen_khoa } : null,
        so_xet_nghiem: x.so_xet_nghiem,
      })),
    });
  } catch (err) {
    console.error("Lỗi listMedicalRecords:", err);
    return fail(res, 500, "Lỗi server");
  }
};

// GET /api/patient/medical-records/:id
// Chi tiết 1 lần khám. Kiểm tra quyền sở hữu NGAY TRONG câu truy vấn (benh_nhan_id + DA_XONG).
const getMedicalRecord = async (req, res) => {
  try {
    const bnId = await loadPatientId(req, res);
    if (!bnId) return;
    const hoSoId = parseId(req.params.id);
    if (!hoSoId) return fail(res, 400, "Mã hồ sơ không hợp lệ");

    const rec = await pool.query(
      `SELECT hs.id AS ho_so_id, to_char(hs.ngay_kham, 'YYYY-MM-DD') AS ngay_kham,
              bs.id AS bs_id, bs.ho_ten AS bs_ho_ten, bs.cap_bac,
              ck.id AS ck_id, ck.ten_chuyen_khoa
       ${RECORD_FROM}
       WHERE hs.id = $1 AND hs.benh_nhan_id = $2 AND hs.trang_thai = $3`,
      [hoSoId, bnId, HS_DA_XONG]
    );
    if (rec.rowCount === 0) return fail(res, 404, NOT_FOUND_MSG);
    const row = rec.rows[0];

    const kq = await pool.query(
      `SELECT trieu_chung_ghi_nhan, chan_doan, loi_dan, don_thuoc
       FROM "KetQuaKham" WHERE ho_so_id = $1 ORDER BY id DESC LIMIT 1`,
      [hoSoId]
    );

    const labs = await pool.query(
      `SELECT c.id, c.ten_xet_nghiem, c.trang_thai, c.thoi_gian_hoan_thanh,
              k.id AS kq_id, k.mo_ta, k.file_ket_qua
       FROM "ChiDinhXetNghiem" c
       LEFT JOIN "KetQuaXetNghiem" k ON k.chi_dinh_id = c.id
       WHERE c.ho_so_id = $1
       ORDER BY c.thoi_gian_chi_dinh, c.id`,
      [hoSoId]
    );

    const k = kq.rows[0] || {};
    return res.json({
      success: true,
      data: {
        ho_so: { id: row.ho_so_id, ngay_kham: row.ngay_kham },
        doctor: toDoctor(row),
        chuyen_khoa: row.ck_id ? { id: row.ck_id, ten_chuyen_khoa: row.ten_chuyen_khoa } : null,
        ket_qua_kham: {
          trieu_chung: k.trieu_chung_ghi_nhan || null,
          chan_doan: k.chan_doan || null,
          loi_dan: k.loi_dan || null,
          don_thuoc: k.don_thuoc || null,
        },
        xet_nghiem: labs.rows.map((c) => {
          const done = c.trang_thai === CD_DA_XONG;
          const ext = done ? extOfStored(c.file_ket_qua) : null;
          return {
            id: c.id,
            ten_xet_nghiem: c.ten_xet_nghiem,
            trang_thai: c.trang_thai,
            thoi_gian_hoan_thanh: c.thoi_gian_hoan_thanh,
            // Chỉ lộ mô tả / file khi chỉ định đã hoàn tất. Không bao giờ trả đường dẫn file trên đĩa.
            mo_ta: done && c.kq_id ? c.mo_ta : null,
            file:
              done && c.kq_id && ext
                ? {
                    file_type: FILE_TYPES[ext].mime,
                    file_url: `/api/patient/medical-records/${hoSoId}/lab-orders/${c.id}/result/file`,
                  }
                : null,
          };
        }),
      },
    });
  } catch (err) {
    console.error("Lỗi getMedicalRecord:", err);
    return fail(res, 500, "Lỗi server");
  }
};

// GET /api/patient/medical-records/:id/lab-orders/:chiDinhId/result/file
// Mở file kết quả xét nghiệm. Backend kiểm đủ 4 điều kiện trong MỘT câu truy vấn:
//   (1) bệnh nhân hiện tại  (2) hồ sơ thuộc bệnh nhân + DA_XONG
//   (3) chỉ định thuộc hồ sơ  (4) file thuộc đúng chỉ định (KetQuaXetNghiem.chi_dinh_id)
const downloadLabResultFile = async (req, res) => {
  try {
    const bnId = await loadPatientId(req, res);
    if (!bnId) return;
    const hoSoId = parseId(req.params.id);
    const chiDinhId = parseId(req.params.chiDinhId);
    if (!hoSoId || !chiDinhId) return fail(res, 400, "Mã hồ sơ hoặc mã xét nghiệm không hợp lệ");

    const r = await pool.query(
      `SELECT c.id AS chi_dinh_id, k.file_ket_qua
       FROM "HoSoBenhAn" hs
       JOIN "ChiDinhXetNghiem" c ON c.ho_so_id = hs.id
       JOIN "KetQuaXetNghiem" k ON k.chi_dinh_id = c.id
       WHERE hs.id = $1 AND hs.benh_nhan_id = $2 AND hs.trang_thai = $3
         AND c.id = $4 AND c.trang_thai = $5`,
      [hoSoId, bnId, HS_DA_XONG, chiDinhId, CD_DA_XONG]
    );
    // Không phải của mình / không thuộc hồ sơ / chưa xong / chưa có file: cùng một lỗi 404
    if (r.rowCount === 0 || !r.rows[0].file_ket_qua) {
      return fail(res, 404, "Không tìm thấy file kết quả", "RESULT_NOT_FOUND");
    }

    const stored = r.rows[0].file_ket_qua;
    const abs = resolveStoredPath(stored);
    const ext = extOfStored(stored);
    if (!abs || !ext) return fail(res, 404, "Không tìm thấy file kết quả", "FILE_NOT_FOUND");

    return res.sendFile(
      abs,
      {
        headers: {
          "Content-Type": FILE_TYPES[ext].mime,
          "Content-Disposition": `inline; filename="ket-qua-xet-nghiem-${chiDinhId}.${ext}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
        dotfiles: "deny",
      },
      (err) => {
        if (err && !res.headersSent) fail(res, 404, "Không tìm thấy file kết quả", "FILE_NOT_FOUND");
      }
    );
  } catch (err) {
    console.error("Lỗi downloadLabResultFile:", err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = { listMedicalRecords, getMedicalRecord, downloadLabResultFile };
