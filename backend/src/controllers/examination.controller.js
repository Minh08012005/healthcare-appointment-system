const pool = require("../config/db");

const ROLE_BAC_SI = "Bác sĩ";
const LANE_LABEL = { ONLINE: "A", OFFLINE: "B" };
const INT_MAX = 2147483647;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const HS_DANG_KHAM = "DANG_KHAM";
const HS_DA_XONG = "DA_XONG";
const CD_DA_XONG = "DA_XONG";
const RESULT_FIELDS = ["trieu_chung_ghi_nhan", "chan_doan", "loi_dan", "don_thuoc"];
const MAX_FIELD_LENGTH = 10000;

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const onlyDoctor = (req, res, message = "Chỉ bác sĩ mới được xem hồ sơ khám") => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    fail(res, 403, message);
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

// Chuẩn hoá body của API lưu kết quả khám.
// Cập nhật từng phần: trường không gửi -> giữ nguyên; chuỗi rỗng/null -> xoá nội dung (NULL).
// Trả { values } (chỉ gồm các trường được gửi) hoặc { message } khi dữ liệu không hợp lệ.
const parseResultBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { message: "Body phải là JSON object" };
  }
  const values = {};
  for (const key of RESULT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const v = body[key];
    if (v === null) {
      values[key] = null;
      continue;
    }
    if (typeof v !== "string") return { message: `${key} phải là chuỗi hoặc null` };
    const t = v.trim();
    if (t.length > MAX_FIELD_LENGTH) {
      return { message: `${key} không được vượt quá ${MAX_FIELD_LENGTH} ký tự` };
    }
    values[key] = t === "" ? null : t;
  }
  if (Object.keys(values).length === 0) {
    return { message: `Cần gửi ít nhất một trong các trường: ${RESULT_FIELDS.join(", ")}` };
  }
  return { values };
};

// PUT /api/examinations/:hoSoId/result
// Lưu/cập nhật KetQuaKham của hồ sơ đang khám (upsert, không tạo dòng trùng).
const saveExamResult = async (req, res) => {
  if (!onlyDoctor(req, res, "Chỉ bác sĩ mới được ghi nhận kết quả khám")) return;
  const hoSoId = parseId(req.params.hoSoId);
  if (!hoSoId) return fail(res, 400, "ho_so_id không hợp lệ");

  const parsed = parseResultBody(req.body);
  if (!parsed.values) return fail(res, 400, parsed.message);
  const { values } = parsed;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Tài khoản chưa gắn với hồ sơ bác sĩ");
    }

    // Khoá dòng hồ sơ: các lần lưu đồng thời của cùng một hồ sơ được xếp hàng,
    // nên không thể cùng lúc INSERT hai KetQuaKham cho một ho_so_id.
    const hs = await client.query(
      `SELECT hs.id, hs.trang_thai, COALESCE(hs.bac_si_id, h.bac_si_id) AS owner_bs_id
       FROM "HoSoBenhAn" hs
       LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
       WHERE hs.id = $1
       FOR UPDATE OF hs`,
      [hoSoId]
    );
    if (hs.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Không tìm thấy hồ sơ khám");
    }
    const record = hs.rows[0];
    if (record.owner_bs_id !== bs.rows[0].id) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Bạn không có quyền cập nhật hồ sơ này");
    }
    if (record.trang_thai !== HS_DANG_KHAM) {
      await client.query("ROLLBACK");
      return fail(
        res,
        409,
        `Chỉ được cập nhật kết quả khi hồ sơ đang khám (trạng thái hiện tại: ${record.trang_thai})`
      );
    }

    // Cùng quy ước với API đọc C4-02: dòng KetQuaKham mới nhất (id lớn nhất) của hồ sơ.
    const existing = await client.query(
      `SELECT id FROM "KetQuaKham" WHERE ho_so_id = $1 ORDER BY id DESC LIMIT 1`,
      [hoSoId]
    );

    let saved;
    let created = false;
    if (existing.rowCount > 0) {
      const keys = Object.keys(values);
      const sets = keys.map((k, i) => `"${k}" = $${i + 2}`).join(", ");
      saved = await client.query(
        `UPDATE "KetQuaKham" SET ${sets} WHERE id = $1
         RETURNING id, trieu_chung_ghi_nhan, chan_doan, loi_dan, don_thuoc`,
        [existing.rows[0].id, ...keys.map((k) => values[k])]
      );
    } else {
      created = true;
      saved = await client.query(
        `INSERT INTO "KetQuaKham" (ho_so_id, trieu_chung_ghi_nhan, chan_doan, loi_dan, don_thuoc)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, trieu_chung_ghi_nhan, chan_doan, loi_dan, don_thuoc`,
        [hoSoId, ...RESULT_FIELDS.map((k) => values[k] ?? null)]
      );
    }

    await client.query("COMMIT");
    return res.status(created ? 201 : 200).json({
      success: true,
      message: created ? "Đã lưu kết quả khám" : "Đã cập nhật kết quả khám",
      data: {
        ho_so: { id: hoSoId, trang_thai: record.trang_thai },
        ket_qua_kham: saved.rows[0],
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Lỗi saveExamResult:", err);
    return fail(res, 500, "Lỗi server");
  } finally {
    client.release();
  }
};

// POST /api/examinations/:hoSoId/close
// Đóng hồ sơ khám bệnh: HoSoBenhAn.trang_thai = 'DA_XONG', HangDoi.trang_thai = 'DA_XONG'.
// Điều kiện:
// - Đúng bác sĩ phụ trách (403);
// - Hồ sơ tồn tại (404);
// - Hồ sơ đang ở trạng thái DANG_KHAM (409);
// - Không có ChiDinhXetNghiem nào của hồ sơ có trang_thai <> 'DA_XONG' (409 LAB_ORDER_PENDING).
const closeExamination = async (req, res) => {
  if (!onlyDoctor(req, res, "Chỉ bác sĩ mới được đóng hồ sơ khám")) return;
  const hoSoId = parseId(req.params.hoSoId);
  if (!hoSoId) return fail(res, 400, "ho_so_id không hợp lệ");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const bs = await client.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
    if (bs.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Tài khoản chưa gắn với hồ sơ bác sĩ");
    }

    // Khóa dòng hồ sơ: các giao dịch close, saveResult, createLabOrder của cùng hồ sơ được tuần tự hóa
    const hs = await client.query(
      `SELECT hs.id, hs.trang_thai, hs.hang_doi_id, COALESCE(hs.bac_si_id, h.bac_si_id) AS owner_bs_id
       FROM "HoSoBenhAn" hs
       LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
       WHERE hs.id = $1
       FOR UPDATE OF hs`,
      [hoSoId]
    );
    if (hs.rowCount === 0) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Không tìm thấy hồ sơ khám");
    }
    const record = hs.rows[0];
    if (record.owner_bs_id !== bs.rows[0].id) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Bạn không có quyền đóng hồ sơ này");
    }
    if (record.trang_thai !== HS_DANG_KHAM) {
      await client.query("ROLLBACK");
      return fail(
        res,
        409,
        `Chỉ có thể đóng hồ sơ khi đang khám (trạng thái hiện tại: ${record.trang_thai})`
      );
    }

    // Kiểm tra chỉ định xét nghiệm chưa hoàn thành
    const pending = await client.query(
      `SELECT id, ten_xet_nghiem, trang_thai
       FROM "ChiDinhXetNghiem"
       WHERE ho_so_id = $1 AND trang_thai <> $2
       LIMIT 1`,
      [hoSoId, CD_DA_XONG]
    );
    if (pending.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        code: "LAB_ORDER_PENDING",
        message: "Không thể đóng hồ sơ khi còn chỉ định xét nghiệm chưa hoàn thành",
      });
    }

    // Cập nhật HoSoBenhAn và HangDoi trong cùng transaction
    await client.query(
      `UPDATE "HoSoBenhAn" SET trang_thai = $1 WHERE id = $2`,
      [HS_DA_XONG, hoSoId]
    );

    if (record.hang_doi_id) {
      await client.query(
        `UPDATE "HangDoi" SET trang_thai = $1 WHERE id = $2`,
        [HS_DA_XONG, record.hang_doi_id]
      );
    }

    await client.query("COMMIT");
    return res.json({
      success: true,
      message: "Đã đóng hồ sơ khám bệnh",
      data: {
        ho_so_id: hoSoId,
        hang_doi_id: record.hang_doi_id || null,
        trang_thai: HS_DA_XONG,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Lỗi closeExamination:", err);
    return fail(res, 500, "Lỗi server");
  } finally {
    client.release();
  }
};

module.exports = { getExamination, getHistory, saveExamResult, closeExamination };