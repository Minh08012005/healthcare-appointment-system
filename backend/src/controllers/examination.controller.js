const pool = require("../config/db");

const ROLE_BAC_SI = "Bác sĩ";
const LANE_LABEL = { ONLINE: "A", OFFLINE: "B" };
const INT_MAX = 2147483647;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const onlyDoctor = (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    fail(res, 403, "Chỉ bác sĩ mới được xem hồ sơ khám");
    return false;
  }
  return true;
};

// Tải hồ sơ và kiểm tra quyền. Trả { row } hoặc { status, message }.
// Chủ hồ sơ = HoSoBenhAn.bac_si_id; nếu NULL thì lấy HangDoi.bac_si_id (lượt Offline được gán khi gọi).
const loadOwnedRecord = async (req, hoSoId) => {
  const bs = await pool.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
  if (bs.rowCount === 0) return { status: 403, message: "Tài khoản chưa gắn với hồ sơ bác sĩ" };

  const r = await pool.query(
    `SELECT hs.id AS ho_so_id, hs.trang_thai AS ho_so_trang_thai,
            to_char(hs.ngay_kham, 'YYYY-MM-DD') AS ngay_kham,
            COALESCE(hs.bac_si_id, h.bac_si_id) AS owner_bs_id,
            bn.id AS bn_id, bn.ho_ten AS bn_ho_ten,
            to_char(bn.ngay_sinh, 'YYYY-MM-DD') AS bn_ngay_sinh,
            bn.gioi_tinh, bn.ma_bhyt, bn.dia_chi, tk.so_dien_thoai,
            h.id AS hd_id, h.loai, h.so_thu_tu, h.trang_thai AS hd_trang_thai,
            h.so_lan_goi, h.so_lan_bo_luot, h.dat_lich_id, h.phong_kham_id,
            bs.id AS bs_id, bs.ho_ten AS bs_ho_ten, bs.cap_bac,
            pk.ten_phong, ck.ten_chuyen_khoa,
            d.ma_dat_lich, to_char(d.gio_kham, 'HH24:MI:SS') AS gio_kham,
            d.trieu_chung AS trieu_chung_dat_lich
     FROM "HoSoBenhAn" hs
     JOIN "BenhNhan" bn ON bn.id = hs.benh_nhan_id
     LEFT JOIN "TaiKhoan" tk ON tk.id = bn.tai_khoan_id
     LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
     LEFT JOIN "BacSi" bs ON bs.id = COALESCE(hs.bac_si_id, h.bac_si_id)
     LEFT JOIN "PhongKham" pk ON pk.id = h.phong_kham_id
     LEFT JOIN "ChuyenKhoa" ck ON ck.id = pk.chuyen_khoa_id
     LEFT JOIN "DatLichKham" d ON d.id = h.dat_lich_id
     WHERE hs.id = $1`,
    [hoSoId]
  );
  if (r.rowCount === 0) return { status: 404, message: "Không tìm thấy hồ sơ khám" };

  const row = r.rows[0];
  if (row.owner_bs_id !== bs.rows[0].id) {
    return { status: 403, message: "Bạn không có quyền xem hồ sơ này" };
  }
  return { row };
};

// GET /api/examinations/:hoSoId
const getExamination = async (req, res) => {
  if (!onlyDoctor(req, res)) return;
  const hoSoId = parseId(req.params.hoSoId);
  if (!hoSoId) return fail(res, 400, "ho_so_id không hợp lệ");

  try {
    const { row, status, message } = await loadOwnedRecord(req, hoSoId);
    if (!row) return fail(res, status, message);

    const kq = await pool.query(
      `SELECT id, trieu_chung_ghi_nhan, chan_doan, loi_dan, don_thuoc
       FROM "KetQuaKham" WHERE ho_so_id = $1 ORDER BY id DESC LIMIT 1`,
      [hoSoId]
    );

    return res.json({
      success: true,
      data: {
        ho_so: { id: row.ho_so_id, ngay_kham: row.ngay_kham, trang_thai: row.ho_so_trang_thai },
        patient: {
          id: row.bn_id,
          ho_ten: row.bn_ho_ten,
          ngay_sinh: row.bn_ngay_sinh,
          gioi_tinh: row.gioi_tinh,
          ma_bhyt: row.ma_bhyt,
          dia_chi: row.dia_chi,
          so_dien_thoai: row.so_dien_thoai,
        },
        queue: row.hd_id
          ? {
              id: row.hd_id,
              loai: row.loai,
              so_thu_tu: row.so_thu_tu,
              nhan_stt: `${LANE_LABEL[row.loai] || ""}${row.so_thu_tu}`,
              trang_thai: row.hd_trang_thai,
              so_lan_goi: row.so_lan_goi,
              so_lan_bo_luot: row.so_lan_bo_luot,
              dat_lich_id: row.dat_lich_id,
            }
          : null,
        doctor: row.bs_id ? { id: row.bs_id, ho_ten: row.bs_ho_ten, cap_bac: row.cap_bac } : null,
        room: row.phong_kham_id
          ? { id: row.phong_kham_id, ten_phong: row.ten_phong, ten_chuyen_khoa: row.ten_chuyen_khoa }
          : null,
        appointment: row.ma_dat_lich
          ? {
              ma_dat_lich: row.ma_dat_lich,
              gio_kham: row.gio_kham,
              trieu_chung: row.trieu_chung_dat_lich,
            }
          : null,
        ket_qua_kham: kq.rows[0] || null,
      },
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// GET /api/examinations/:hoSoId/history?limit=
const getHistory = async (req, res) => {
  if (!onlyDoctor(req, res)) return;
  const hoSoId = parseId(req.params.hoSoId);
  if (!hoSoId) return fail(res, 400, "ho_so_id không hợp lệ");

  let limit = DEFAULT_LIMIT;
  if (req.query.limit !== undefined) {
    if (typeof req.query.limit !== "string" || !/^\d{1,3}$/.test(req.query.limit)) {
      return fail(res, 400, `limit phải từ 1 đến ${MAX_LIMIT}`);
    }
    limit = Number(req.query.limit);
    if (limit < 1 || limit > MAX_LIMIT) return fail(res, 400, `limit phải từ 1 đến ${MAX_LIMIT}`);
  }

  try {
    const { row, status, message } = await loadOwnedRecord(req, hoSoId);
    if (!row) return fail(res, status, message);

    // Chỉ lấy hồ sơ TRƯỚC hồ sơ hiện tại của ĐÚNG bệnh nhân này
    const h = await pool.query(
      `SELECT hs.id AS ho_so_id, to_char(hs.ngay_kham, 'YYYY-MM-DD') AS ngay_kham,
              hs.trang_thai, bs.id AS bs_id, bs.ho_ten AS bs_ho_ten, bs.cap_bac,
              kq.id AS kq_id, kq.trieu_chung_ghi_nhan, kq.chan_doan, kq.loi_dan, kq.don_thuoc
       FROM "HoSoBenhAn" hs
       LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
       LEFT JOIN "BacSi" bs ON bs.id = COALESCE(hs.bac_si_id, h.bac_si_id)
       LEFT JOIN LATERAL (
         SELECT k.id, k.trieu_chung_ghi_nhan, k.chan_doan, k.loi_dan, k.don_thuoc
         FROM "KetQuaKham" k WHERE k.ho_so_id = hs.id ORDER BY k.id DESC LIMIT 1
       ) kq ON true
       WHERE hs.benh_nhan_id = $1 AND hs.id <> $2
         AND (
           hs.ngay_kham < $3::date
           OR (hs.ngay_kham = $3::date AND hs.id < $2)
           OR ($3::date IS NULL AND hs.id < $2)
         )
       ORDER BY hs.ngay_kham DESC, hs.id DESC
       LIMIT $4`,
      [row.bn_id, hoSoId, row.ngay_kham, limit]
    );

    return res.json({
      success: true,
      data: {
        ho_so_id: hoSoId,
        benh_nhan_id: row.bn_id,
        history: h.rows.map((x) => ({
          ho_so_id: x.ho_so_id,
          ngay_kham: x.ngay_kham,
          trang_thai: x.trang_thai,
          doctor: x.bs_id ? { id: x.bs_id, ho_ten: x.bs_ho_ten, cap_bac: x.cap_bac } : null,
          ket_qua_kham_id: x.kq_id || null,
          trieu_chung: x.trieu_chung_ghi_nhan || null,
          chan_doan: x.chan_doan || null,
          loi_dan: x.loi_dan || null,
          don_thuoc: x.don_thuoc || null,
        })),
      },
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = { getExamination, getHistory };