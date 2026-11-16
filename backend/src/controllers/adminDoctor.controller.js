const pool = require("../config/db");

// C6-02: Admin quản lý thông tin bác sĩ (họ tên, chuyên khoa, cấp bậc, mức phí).
// Không tạo/sửa TaiKhoan, không xóa bác sĩ, không đụng master.controller.js.
const ROLE_ADMIN = "Quản trị viên";
const MAX_HO_TEN = 100; // khớp VARCHAR(100)
const MAX_CAP_BAC = 100;
const MAX_Q = 100;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const INT_MAX = 2147483647;

const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

const onlyAdmin = (req, res) => {
  if (!req.user || req.user.role !== ROLE_ADMIN) {
    fail(res, 403, "Chỉ quản trị viên mới được thực hiện thao tác này");
    return false;
  }
  return true;
};

// id trên URL / query (chuỗi)
const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

// id trong body (số hoặc chuỗi số)
const parseBodyId = (v) => {
  if (typeof v === "number") return Number.isInteger(v) && v > 0 && v <= INT_MAX ? v : null;
  return parseId(typeof v === "string" ? v.trim() : v);
};

// NUMERIC(12,2): tối đa 10 chữ số phần nguyên, 2 chữ số thập phân
const parseFee = (v) => {
  let s;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { ok: false };
    s = String(v);
  } else if (typeof v === "string") {
    s = v.trim();
  } else {
    return { ok: false };
  }
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return { ok: false };
  return { ok: true, value: s };
};

const has = (b, k) => Object.prototype.hasOwnProperty.call(b, k);

// isCreate: ho_ten và chuyen_khoa_id bắt buộc. Update: chỉ cần ít nhất 1 trường, trường nào gửi lên thì validate.
const parseBody = (body, isCreate) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { message: "Body phải là JSON object" };
  const f = {};

  if (isCreate || has(body, "ho_ten")) {
    if (typeof body.ho_ten !== "string" || body.ho_ten.trim() === "") {
      return { message: "ho_ten là bắt buộc và không được để trống" };
    }
    const t = body.ho_ten.trim();
    if (t.length > MAX_HO_TEN) return { message: `ho_ten không được vượt quá ${MAX_HO_TEN} ký tự` };
    f.ho_ten = t;
  }

  if (isCreate || has(body, "chuyen_khoa_id")) {
    const id = parseBodyId(body.chuyen_khoa_id);
    if (!id) return { message: "chuyen_khoa_id là bắt buộc và phải là số nguyên dương" };
    f.chuyen_khoa_id = id;
  }

  if (has(body, "cap_bac")) {
    if (body.cap_bac === null) {
      f.cap_bac = null;
    } else {
      if (typeof body.cap_bac !== "string") return { message: "cap_bac phải là chuỗi" };
      const t = body.cap_bac.trim();
      if (t.length > MAX_CAP_BAC) return { message: `cap_bac không được vượt quá ${MAX_CAP_BAC} ký tự` };
      f.cap_bac = t === "" ? null : t;
    }
  }

  if (has(body, "muc_phi")) {
    if (body.muc_phi === null) {
      f.muc_phi = null;
    } else {
      const fee = parseFee(body.muc_phi);
      if (!fee.ok) return { message: "muc_phi phải là số không âm, tối đa 10 chữ số nguyên và 2 chữ số thập phân" };
      f.muc_phi = fee.value;
    }
  }

  if (!isCreate && Object.keys(f).length === 0) {
    return { message: "Cần gửi ít nhất một trường: ho_ten, chuyen_khoa_id, cap_bac, muc_phi" };
  }
  return { value: f };
};

const SELECT = `
  SELECT b.id, b.ho_ten, b.cap_bac, b.muc_phi, b.chuyen_khoa_id, b.tai_khoan_id, ck.ten_chuyen_khoa
  FROM "BacSi" b
  LEFT JOIN "ChuyenKhoa" ck ON ck.id = b.chuyen_khoa_id`;

const toDto = (r) => ({
  id: r.id,
  ho_ten: r.ho_ten,
  cap_bac: r.cap_bac,
  muc_phi: r.muc_phi === null ? null : Number(r.muc_phi),
  chuyen_khoa: r.chuyen_khoa_id ? { id: r.chuyen_khoa_id, ten_chuyen_khoa: r.ten_chuyen_khoa } : null,
  co_tai_khoan: r.tai_khoan_id !== null,
});

const specialtyExists = async (db, id) => (await db.query(`SELECT 1 FROM "ChuyenKhoa" WHERE id = $1`, [id])).rowCount > 0;

// GET /api/admin/doctors?chuyen_khoa_id=&q=&limit=
const listDoctors = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  try {
    let ckId = null;
    if (req.query.chuyen_khoa_id !== undefined) {
      ckId = parseId(req.query.chuyen_khoa_id);
      if (!ckId) return fail(res, 400, "chuyen_khoa_id không hợp lệ");
    }
    let q = null;
    if (req.query.q !== undefined) {
      if (typeof req.query.q !== "string") return fail(res, 400, "q không hợp lệ");
      const t = req.query.q.trim();
      if (t.length > MAX_Q) return fail(res, 400, `q không được vượt quá ${MAX_Q} ký tự`);
      q = t === "" ? null : `%${t.replace(/[\\%_]/g, "\\$&")}%`;
    }
    let limit = DEFAULT_LIMIT;
    if (req.query.limit !== undefined) {
      if (typeof req.query.limit !== "string" || !/^\d{1,3}$/.test(req.query.limit)) {
        return fail(res, 400, `limit phải từ 1 đến ${MAX_LIMIT}`);
      }
      limit = Number(req.query.limit);
      if (limit < 1 || limit > MAX_LIMIT) return fail(res, 400, `limit phải từ 1 đến ${MAX_LIMIT}`);
    }

    const r = await pool.query(
      `${SELECT}
       WHERE ($1::int IS NULL OR b.chuyen_khoa_id = $1)
         AND ($2::text IS NULL OR b.ho_ten ILIKE $2 ESCAPE '\\')
       ORDER BY b.ho_ten, b.id
       LIMIT $3`,
      [ckId, q, limit]
    );
    return res.json({ success: true, data: { items: r.rows.map(toDto) } });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// GET /api/admin/doctors/:id
const getDoctor = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id bác sĩ không hợp lệ");
  try {
    const r = await pool.query(`${SELECT} WHERE b.id = $1`, [id]);
    if (r.rowCount === 0) return fail(res, 404, "Không tìm thấy bác sĩ");
    return res.json({ success: true, data: toDto(r.rows[0]) });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// POST /api/admin/doctors   body: { ho_ten, chuyen_khoa_id, cap_bac?, muc_phi? }
const createDoctor = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const p = parseBody(req.body, true);
  if (!p.value) return fail(res, 400, p.message);
  const f = p.value;
  try {
    if (!(await specialtyExists(pool, f.chuyen_khoa_id))) {
      return fail(res, 400, "chuyen_khoa_id không hợp lệ: không có chuyên khoa này");
    }
    const ins = await pool.query(
      `INSERT INTO "BacSi" (ho_ten, chuyen_khoa_id, cap_bac, muc_phi) VALUES ($1, $2, $3, $4) RETURNING id`,
      [f.ho_ten, f.chuyen_khoa_id, f.cap_bac ?? null, f.muc_phi ?? null]
    );
    const row = await pool.query(`${SELECT} WHERE b.id = $1`, [ins.rows[0].id]);
    return res.status(201).json({ success: true, data: toDto(row.rows[0]) });
  } catch (err) {
    if (err.code === "23503") return fail(res, 400, "chuyen_khoa_id không hợp lệ: không có chuyên khoa này");
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// PUT /api/admin/doctors/:id   (cập nhật một phần: chỉ trường nào gửi lên mới đổi)
const COLUMNS = { ho_ten: "ho_ten", chuyen_khoa_id: "chuyen_khoa_id", cap_bac: "cap_bac", muc_phi: "muc_phi" };

const updateDoctor = async (req, res) => {
  if (!onlyAdmin(req, res)) return;
  const id = parseId(req.params.id);
  if (!id) return fail(res, 400, "id bác sĩ không hợp lệ");
  const p = parseBody(req.body, false);
  if (!p.value) return fail(res, 400, p.message);
  const f = p.value;
  try {
    if (f.chuyen_khoa_id !== undefined && !(await specialtyExists(pool, f.chuyen_khoa_id))) {
      return fail(res, 400, "chuyen_khoa_id không hợp lệ: không có chuyên khoa này");
    }
    const sets = [];
    const vals = [id];
    for (const key of Object.keys(f)) {
      vals.push(f[key]);
      sets.push(`${COLUMNS[key]} = $${vals.length}`);
    }
    const upd = await pool.query(`UPDATE "BacSi" SET ${sets.join(", ")} WHERE id = $1 RETURNING id`, vals);
    if (upd.rowCount === 0) return fail(res, 404, "Không tìm thấy bác sĩ");
    const row = await pool.query(`${SELECT} WHERE b.id = $1`, [id]);
    return res.json({ success: true, data: toDto(row.rows[0]) });
  } catch (err) {
    if (err.code === "23503") return fail(res, 400, "chuyen_khoa_id không hợp lệ: không có chuyên khoa này");
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = { listDoctors, getDoctor, createDoctor, updateDoctor };