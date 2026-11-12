const pool = require("../config/db");
const { getStaffRoom } = require("./labRoom.controller");
const {
  MAX_MO_TA,
  FILE_TYPES,
  detectFileType,
  saveResultFile,
  resolveStoredPath,
  extOfStored,
  removeStoredFile,
} = require("../utils/labResultFile");

// C5-03: nhân viên phòng xét nghiệm nộp kết quả và hoàn tất chỉ định (DANG_XU_LY -> DA_XONG).
// Đọc kết quả cho nhân viên phòng XN (C5-04) và bác sĩ chủ hồ sơ (C5-05).
// KHÔNG làm danh sách/bắt đầu xử lý (C5-02), notification, UI, và KHÔNG đóng HoSoBenhAn.

const ROLE_BAC_SI = "Bác sĩ";
const ST_CHO = "CHO_XU_LY";
const ST_DANG = "DANG_XU_LY";
const ST_XONG = "DA_XONG";
const INT_MAX = 2147483647;

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

const fail = (res, status, message, code, data) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}), ...(data ? { data } : {}) });

const STATE_MESSAGES = {
  [ST_CHO]: "Chỉ định chưa được bắt đầu xử lý nên chưa thể nộp kết quả",
  [ST_XONG]: "Chỉ định đã hoàn thành, không thể nộp hoặc sửa kết quả",
};

// URL tải file theo từng vai trò (frontend gọi kèm Authorization rồi tạo blob URL để mở)
const FILE_URL = {
  staff: (id) => `/api/lab/orders/${id}/result/file`,
  doctor: (id) => `/api/lab-orders/${id}/result/file`,
};

const toChiDinh = (r) => ({
  id: r.chi_dinh_id,
  ho_so_id: r.ho_so_id,
  trang_thai: r.trang_thai,
  ten_xet_nghiem: r.ten_xet_nghiem,
  nhan_vien_xu_ly_id: r.nhan_vien_xu_ly_id,
  thoi_gian_bat_dau: r.thoi_gian_bat_dau,
  thoi_gian_hoan_thanh: r.thoi_gian_hoan_thanh,
});

const toKetQua = (r, audience) => {
  if (!r.kq_id) return null;
  const ext = extOfStored(r.file_ket_qua);
  return {
    id: r.kq_id,
    chi_dinh_id: r.chi_dinh_id,
    mo_ta: r.mo_ta,
    file_ket_qua: r.file_ket_qua,
    file_type: ext ? FILE_TYPES[ext].mime : null,
    file_url: r.file_ket_qua ? FILE_URL[audience](r.chi_dinh_id) : null,
  };
};

const ORDER_COLS = `
  c.id AS chi_dinh_id, c.ho_so_id, c.phong_kham_id, c.trang_thai, c.ten_xet_nghiem,
  c.nhan_vien_xu_ly_id, c.thoi_gian_bat_dau, c.thoi_gian_hoan_thanh,
  k.id AS kq_id, k.file_ket_qua, k.mo_ta`;
const ORDER_SELECT = `
  SELECT ${ORDER_COLS}
  FROM "ChiDinhXetNghiem" c
  LEFT JOIN "KetQuaXetNghiem" k ON k.chi_dinh_id = c.id`;

// ---------------------------------------------------------------------------
// POST /api/lab/orders/:id/result   (multipart/form-data: file, mo_ta?)
// ---------------------------------------------------------------------------
const submitResult = async (req, res) => {
  let client;
  let storedFile = null;
  try {
    const roomId = await getStaffRoom(pool, req, res);
    if (!roomId) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id chỉ định không hợp lệ");

    // --- Kiểm tra nội dung upload (chưa ghi gì ra đĩa / DB) ---
    if (!req.file) return fail(res, 400, 'Thiếu file kết quả (field "file")', "FILE_REQUIRED");
    if (req.file.size === 0) return fail(res, 400, "File kết quả rỗng", "FILE_REQUIRED");
    const ext = detectFileType(req.file.buffer);
    if (!ext) {
      return fail(res, 415, "Chỉ chấp nhận file PDF hoặc hình ảnh (JPG, PNG, WebP)", "INVALID_FILE_TYPE");
    }
    const rawMoTa = req.body ? req.body.mo_ta : undefined;
    let moTa = null;
    if (rawMoTa !== undefined) {
      if (typeof rawMoTa !== "string") return fail(res, 400, "mo_ta phải là chuỗi");
      moTa = rawMoTa.trim() === "" ? null : rawMoTa.trim();
      if (moTa && moTa.length > MAX_MO_TA) return fail(res, 400, `mo_ta không được vượt quá ${MAX_MO_TA} ký tự`);
    }

    client = await pool.connect();
    await client.query("BEGIN");
    const abort = async (status, message, code, data) => {
      await client.query("ROLLBACK");
      return fail(res, status, message, code, data);
    };

    // Khóa dòng chỉ định: nộp kết quả đồng thời chỉ một request thành công (cùng cách C5-02 dùng cho start)
    const lock = await client.query(
      `SELECT id, ho_so_id, phong_kham_id, trang_thai FROM "ChiDinhXetNghiem" WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (lock.rowCount === 0) return abort(404, "Không tìm thấy chỉ định xét nghiệm");
    const order = lock.rows[0];
    if (order.phong_kham_id !== roomId) {
      return abort(403, "Chỉ định này không thuộc phòng xét nghiệm của bạn");
    }
    if (order.trang_thai !== ST_DANG) {
      return abort(
        409,
        STATE_MESSAGES[order.trang_thai] || "Chỉ định không ở trạng thái có thể nộp kết quả",
        "INVALID_STATE",
        { trang_thai: order.trang_thai }
      );
    }

    // Ghi file rồi mới ghi DB; mọi lỗi từ đây trở đi đều xóa file (xem catch)
    storedFile = await saveResultFile(id, req.file.buffer, ext);
    try {
      await client.query(
        `INSERT INTO "KetQuaXetNghiem" (chi_dinh_id, file_ket_qua, mo_ta) VALUES ($1, $2, $3)`,
        [id, storedFile, moTa]
      );
    } catch (err) {
      if (err.code === "23505") {
        // UNIQUE(chi_dinh_id): đã có kết quả cho chỉ định này
        await removeStoredFile(storedFile);
        storedFile = null;
        return abort(409, "Chỉ định này đã có kết quả", "DUPLICATE_RESULT");
      }
      throw err;
    }
    // Hoàn tất chỉ định: DANG_XU_LY -> DA_XONG + thời gian hoàn thành (nhan_vien_xu_ly_id giữ nguyên từ lúc start)
    const upd = await client.query(
      `UPDATE "ChiDinhXetNghiem" SET trang_thai = $2, thoi_gian_hoan_thanh = NOW()
       WHERE id = $1 AND trang_thai = $3 RETURNING id`,
      [id, ST_XONG, ST_DANG]
    );
    if (upd.rowCount === 0) throw new Error("Không cập nhật được trạng thái chỉ định");

    const out = await client.query(`${ORDER_SELECT} WHERE c.id = $1`, [id]);
    await client.query("COMMIT");
    storedFile = null; // đã commit, giữ file
    return res.status(201).json({
      success: true,
      message: "Đã nộp kết quả và hoàn tất xét nghiệm",
      data: { chi_dinh: toChiDinh(out.rows[0]), ket_qua: toKetQua(out.rows[0], "staff") },
    });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (storedFile) await removeStoredFile(storedFile); // DB lỗi -> không để file mồ côi
    console.error("Lỗi submitResult:", err);
    return fail(res, 500, "Lỗi server");
  } finally {
    if (client) client.release();
  }
};

// ---------------------------------------------------------------------------
// Đọc kết quả: dùng chung cho nhân viên phòng XN và bác sĩ chủ hồ sơ
// ---------------------------------------------------------------------------

// Nhân viên XN: chỉ chỉ định thuộc phòng mình
const loadForStaff = async (req, res) => {
  const roomId = await getStaffRoom(pool, req, res);
  if (!roomId) return null;
  const id = parseId(req.params.id);
  if (!id) return void fail(res, 400, "id chỉ định không hợp lệ");
  const r = await pool.query(`${ORDER_SELECT} WHERE c.id = $1`, [id]);
  if (r.rowCount === 0) return void fail(res, 404, "Không tìm thấy chỉ định xét nghiệm");
  if (r.rows[0].phong_kham_id !== roomId) {
    return void fail(res, 403, "Chỉ định này không thuộc phòng xét nghiệm của bạn");
  }
  return { row: r.rows[0], audience: "staff" };
};

// Bác sĩ: chỉ chỉ định của hồ sơ mình phụ trách (cùng quy tắc C4-02/C4-06: HoSoBenhAn.bac_si_id, nếu NULL thì HangDoi.bac_si_id)
const loadForDoctor = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BAC_SI) {
    return void fail(res, 403, "Chỉ bác sĩ mới được xem kết quả xét nghiệm");
  }
  const id = parseId(req.params.id);
  if (!id) return void fail(res, 400, "id chỉ định không hợp lệ");
  const bs = await pool.query(`SELECT id FROM "BacSi" WHERE tai_khoan_id = $1`, [req.user.id]);
  if (bs.rowCount === 0) return void fail(res, 403, "Tài khoản chưa gắn với hồ sơ bác sĩ");
  const r = await pool.query(
    `SELECT ${ORDER_COLS}, COALESCE(hs.bac_si_id, h.bac_si_id) AS owner_bs_id
     FROM "ChiDinhXetNghiem" c
     LEFT JOIN "KetQuaXetNghiem" k ON k.chi_dinh_id = c.id
     JOIN "HoSoBenhAn" hs ON hs.id = c.ho_so_id
     LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
     WHERE c.id = $1`,
    [id]
  );
  if (r.rowCount === 0) return void fail(res, 404, "Không tìm thấy chỉ định xét nghiệm");
  if (r.rows[0].owner_bs_id !== bs.rows[0].id) {
    return void fail(res, 403, "Bạn không có quyền xem kết quả của chỉ định này");
  }
  return { row: r.rows[0], audience: "doctor" };
};

const makeGetResult = (loader) => async (req, res) => {
  try {
    const ctx = await loader(req, res);
    if (!ctx) return;
    // Chưa hoàn tất thì ket_qua = null; dùng chi_dinh.trang_thai (DA_XONG) để biết đã có kết quả
    return res.json({
      success: true,
      data: { chi_dinh: toChiDinh(ctx.row), ket_qua: toKetQua(ctx.row, ctx.audience) },
    });
  } catch (err) {
    console.error("Lỗi getResult:", err);
    return fail(res, 500, "Lỗi server");
  }
};

const makeDownload = (loader) => async (req, res) => {
  try {
    const ctx = await loader(req, res);
    if (!ctx) return;
    const { row } = ctx;
    if (!row.kq_id || !row.file_ket_qua) {
      return fail(res, 404, "Chỉ định này chưa có file kết quả", "RESULT_NOT_FOUND");
    }
    const abs = resolveStoredPath(row.file_ket_qua);
    const ext = extOfStored(row.file_ket_qua);
    if (!abs || !ext) return fail(res, 404, "Không tìm thấy file kết quả", "FILE_NOT_FOUND");

    return res.sendFile(
      abs,
      {
        headers: {
          "Content-Type": FILE_TYPES[ext].mime,
          "Content-Disposition": `inline; filename="ket-qua-xet-nghiem-${row.chi_dinh_id}.${ext}"`,
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
    console.error("Lỗi downloadResultFile:", err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = {
  submitResult,
  getResultStaff: makeGetResult(loadForStaff),
  downloadResultStaff: makeDownload(loadForStaff),
  getResultDoctor: makeGetResult(loadForDoctor),
  downloadResultDoctor: makeDownload(loadForDoctor),
};
