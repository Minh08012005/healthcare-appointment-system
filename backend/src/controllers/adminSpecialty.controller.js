const pool = require("../config/db");

// C6-02: Admin quản lý chuyên khoa. Không đụng master.controller.js (API Booking).
const ROLE_ADMIN = "Quản trị viên";
const MAX_TEN = 100; // khớp VARCHAR(100)
const MAX_MO_TA = 2000;
const INT_MAX = 2147483647;
const LOCK_KEY = 6002; // serialize ghi chuyên khoa (chống trùng tên khi tạo/sửa đồng thời)

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

const fail = (res, status, message, code, data) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}), ...(data ? { data } : {}) });

const onlyAdmin = (req, res) => {
  if (!req.user || req.user.role !== ROLE_ADMIN) {
    fail(res, 403, "Chỉ quản trị viên mới được thực hiện thao tác này");
    return false;
  }
  return true;
};

const SELECT = `
  SELECT ck.id, ck.ten_chuyen_khoa, ck.mo_ta,
         (SELECT COUNT(*)::int FROM "BacSi" b WHERE b.chuyen_khoa_id = ck.id) AS so_bac_si,
         (SELECT COUNT(*)::int FROM "PhongKham" p WHERE p.chuyen_khoa_id = ck.id) AS so_phong
  FROM "ChuyenKhoa" ck`;

const toDto = (r) => ({
  id: r.id,
  ten_chuyen_khoa: r.ten_chuyen_khoa,
  mo_ta: r.mo_ta,
  so_bac_si: r.so_bac_si,
  so_phong: r.so_phong,
});

// Trả { value } hoặc { message }
const parseBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { message: "Body phải là JSON object" };
  if (typeof body.ten_chuyen_khoa !== "string" || body.ten_chuyen_khoa.trim() === "") {
    return { message: "ten_chuyen_khoa là bắt buộc và không được để trống" };
  }
  const ten = body.ten_chuyen_khoa.trim();
  if (ten.length > MAX_TEN) return { message: `ten_chuyen_khoa không được vượt quá ${MAX_TEN} ký tự` };

  let hasMoTa = false;
  let moTa = null;
  if (body.mo_ta !== undefined) {
    hasMoTa = true;
    if (body.mo_ta !== null) {
      if (typeof body.mo_ta !== "string") return { message: "mo_ta phải là chuỗi" };
      const t = body.mo_ta.trim();
      if (t.length > MAX_MO_TA) return { message: `mo_ta không được vượt quá ${MAX_MO_TA} ký tự` };
      moTa = t === "" ? null : t;
    }
  }
  return { value: { ten, hasMoTa, moTa } };
};

// Chạy trong transaction có khóa ghi chuyên khoa
const withWriteTx = async (res, fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [LOCK_KEY]);
    const out = await fn(client);
    await client.query(out.status >= 400 ? "ROLLBACK" : "COMMIT");
    return res.status(out.status).json(out.body);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      return fail(res, 409, "Tên chuyên khoa đã tồn tại", "DUPLICATE_NAME");
    }
    if (err.code === "23503") {
      return fail(res, 409, "Chuyên khoa còn dữ liệu liên kết, không thể xóa", "HAS_REFERENCES");
    }
    console.error(err);
    return fail(res, 500, "Lỗi server");
  } finally {
    client.release();
  }
};

const bad = (status, message, code, data) => ({
  status,
  body: { success: false, message, ...(code ? { code } : {}), ...(data ? { data } : {}) },
});
const ok = (status, data) => ({ status, body: { success: true, data } });

// GET /api/admin/specialties
const listSpecialties = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  try {
    const r = await pool.query(`${SELECT} ORDER BY ck.ten_chuyen_khoa, ck.id`);
    return res.json({ success: true, data: { items: r.rows.map(toDto) } });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// GET /api/admin/specialties/:id
const getSpecialty = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id chuyên khoa không hợp lệ");
  try {
    const r = await pool.query(`${SELECT} WHERE ck.id = $1`, [id]);
    if (r.rowCount === 0) return fail(res, 404, "Không tìm thấy chuyên khoa");
    return res.json({ success: true, data: toDto(r.rows[0]) });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// POST /api/admin/specialties
const createSpecialty = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const p = parseBody(req.body);
  if (!p.value) return fail(res, 400, p.message);
  const { ten, moTa } = p.value;

  return withWriteTx(res, async (c) => {
    const dup = await c.query(`SELECT id FROM "ChuyenKhoa" WHERE LOWER(ten_chuyen_khoa) = LOWER($1) LIMIT 1`, [ten]);
    if (dup.rowCount > 0) return bad(409, "Tên chuyên khoa đã tồn tại", "DUPLICATE_NAME");
    const ins = await c.query(`INSERT INTO "ChuyenKhoa" (ten_chuyen_khoa, mo_ta) VALUES ($1, $2) RETURNING id`, [ten, moTa]);
    const row = await c.query(`${SELECT} WHERE ck.id = $1`, [ins.rows[0].id]);
    return ok(201, toDto(row.rows[0]));
  });
};

// PUT /api/admin/specialties/:id  (không gửi mo_ta thì giữ nguyên mo_ta)
const updateSpecialty = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id chuyên khoa không hợp lệ");
  const p = parseBody(req.body);
  if (!p.value) return fail(res, 400, p.message);
  const { ten, hasMoTa, moTa } = p.value;

  return withWriteTx(res, async (c) => {
    const cur = await c.query(`SELECT id FROM "ChuyenKhoa" WHERE id = $1 FOR UPDATE`, [id]);
    if (cur.rowCount === 0) return bad(404, "Không tìm thấy chuyên khoa");
    const dup = await c.query(
      `SELECT id FROM "ChuyenKhoa" WHERE LOWER(ten_chuyen_khoa) = LOWER($1) AND id <> $2 LIMIT 1`,
      [ten, id]
    );
    if (dup.rowCount > 0) return bad(409, "Tên chuyên khoa đã tồn tại", "DUPLICATE_NAME");
    await c.query(
      `UPDATE "ChuyenKhoa" SET ten_chuyen_khoa = $2, mo_ta = CASE WHEN $4::boolean THEN $3::text ELSE mo_ta END WHERE id = $1`,
      [id, ten, moTa, hasMoTa]
    );
    const row = await c.query(`${SELECT} WHERE ck.id = $1`, [id]);
    return ok(200, toDto(row.rows[0]));
  });
};

// DELETE /api/admin/specialties/:id  (chặn khi còn bác sĩ, phòng khám hoặc lịch hẹn liên kết)
const deleteSpecialty = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id chuyên khoa không hợp lệ");

  return withWriteTx(res, async (c) => {
    // FOR UPDATE xung đột với FOR KEY SHARE của FK -> không ai gắn bác sĩ/phòng mới vào lúc đang xóa
    const cur = await c.query(`SELECT id FROM "ChuyenKhoa" WHERE id = $1 FOR UPDATE`, [id]);
    if (cur.rowCount === 0) return bad(404, "Không tìm thấy chuyên khoa");

    const refs = (
      await c.query(
        `SELECT (SELECT COUNT(*)::int FROM "BacSi" WHERE chuyen_khoa_id = $1) AS so_bac_si,
                (SELECT COUNT(*)::int FROM "PhongKham" WHERE chuyen_khoa_id = $1) AS so_phong,
                (SELECT COUNT(*)::int FROM "DatLichKham" WHERE chuyen_khoa_id = $1) AS so_lich_hen`,
        [id]
      )
    ).rows[0];
    if (refs.so_bac_si > 0 || refs.so_phong > 0 || refs.so_lich_hen > 0) {
      return bad(409, "Chuyên khoa còn dữ liệu liên kết (bác sĩ, phòng khám hoặc lịch hẹn), không thể xóa", "HAS_REFERENCES", refs);
    }
    await c.query(`DELETE FROM "ChuyenKhoa" WHERE id = $1`, [id]);
    return ok(200, { id, message: "Đã xóa chuyên khoa" });
  });
};

module.exports = { listSpecialties, getSpecialty, createSpecialty, updateSpecialty, deleteSpecialty };