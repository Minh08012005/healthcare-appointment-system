const bcrypt = require("bcryptjs");
const pool = require("../config/db");

// C6-03: Admin quản lý tài khoản nhân viên (Bác sĩ, Lễ tân, Xét nghiệm).
// Không tạo auth mới: dùng bcryptjs như auth hiện tại. Không đụng Patient Register, không đổi tên role.

const ROLE_ADMIN = "Quản trị viên";
const STAFF_ROLES = ["Bác sĩ", "Lễ tân", "Xét nghiệm"];
const ST_ACTIVE = "HoatDong";
const ST_LOCKED = "BiKhoa";
const VALID_STATES = [ST_ACTIVE, ST_LOCKED];
const INT_MAX = 2147483647;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,50}$/;
const PW_MIN = 6;
const PW_MAX = 72; // giới hạn của bcrypt

const fail = (res, status, message, code, data) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}), ...(data ? { data } : {}) });

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

const isObj = (b) => b && typeof b === "object" && !Array.isArray(b);

const requireAdmin = (req, res) => {
  if (!req.user || req.user.role !== ROLE_ADMIN) {
    fail(res, 403, "Chỉ quản trị viên mới được thực hiện thao tác này");
    return false;
  }
  return true;
};

const BASE_SELECT = `
  SELECT tk.id, tk.ten_dang_nhap, tk.trang_thai, tk.phong_kham_id,
         vt.id AS vai_tro_id, vt.ten_vai_tro,
         bs.id AS bac_si_id, bs.ho_ten AS bac_si_ho_ten
  FROM "TaiKhoan" tk
  JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id
  LEFT JOIN "BacSi" bs ON bs.tai_khoan_id = tk.id`;

const toAccount = (r) => ({
  id: r.id,
  ten_dang_nhap: r.ten_dang_nhap,
  vai_tro: r.ten_vai_tro,
  vai_tro_id: r.vai_tro_id,
  trang_thai: r.trang_thai,
  phong_kham_id: r.phong_kham_id,
  bac_si: r.bac_si_id ? { id: r.bac_si_id, ho_ten: r.bac_si_ho_ten } : null,
});

const getAccount = async (db, id) => {
  const r = await db.query(`${BASE_SELECT} WHERE tk.id = $1 AND vt.ten_vai_tro = ANY($2::text[])`, [id, STAFF_ROLES]);
  return r.rows[0] ? toAccount(r.rows[0]) : null;
};

// Trả message lỗi nếu username sai, ngược lại null
const checkUsername = (v) => {
  if (typeof v !== "string") return "ten_dang_nhap phải là chuỗi";
  if (!USERNAME_RE.test(v.trim())) return "ten_dang_nhap dài 3-50 ký tự, chỉ gồm chữ, số, _ . -";
  return null;
};
const checkPassword = (v) => {
  if (typeof v !== "string") return "password phải là chuỗi";
  if (v.length < PW_MIN || v.length > PW_MAX) return `password dài ${PW_MIN}-${PW_MAX} ký tự`;
  return null;
};
const checkRole = (v) => (typeof v === "string" && STAFF_ROLES.includes(v.trim()) ? null : `vai_tro phải thuộc: ${STAFF_ROLES.join(", ")}`);

// GET /api/admin/accounts?vai_tro=&trang_thai=&q=&limit=
const listAccounts = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { vai_tro, trang_thai, q } = req.query;

    if (vai_tro !== undefined && (typeof vai_tro !== "string" || !STAFF_ROLES.includes(vai_tro))) {
      return fail(res, 400, `vai_tro phải thuộc: ${STAFF_ROLES.join(", ")}`);
    }
    if (trang_thai !== undefined && (typeof trang_thai !== "string" || !VALID_STATES.includes(trang_thai))) {
      return fail(res, 400, `trang_thai phải thuộc: ${VALID_STATES.join(", ")}`);
    }
    if (q !== undefined && typeof q !== "string") return fail(res, 400, "q không hợp lệ");

    let limit = DEFAULT_LIMIT;
    if (req.query.limit !== undefined) {
      if (typeof req.query.limit !== "string" || !/^\d{1,3}$/.test(req.query.limit)) {
        return fail(res, 400, `limit phải từ 1 đến ${MAX_LIMIT}`);
      }
      limit = Number(req.query.limit);
      if (limit < 1 || limit > MAX_LIMIT) return fail(res, 400, `limit phải từ 1 đến ${MAX_LIMIT}`);
    }

    const like = q && q.trim() ? `%${q.trim().replace(/[\\%_]/g, "\\$&")}%` : null;
    const r = await pool.query(
      `${BASE_SELECT}
       WHERE vt.ten_vai_tro = ANY($1::text[])
         AND ($2::text IS NULL OR vt.ten_vai_tro = $2)
         AND ($3::text IS NULL OR tk.trang_thai = $3)
         AND ($4::text IS NULL OR tk.ten_dang_nhap ILIKE $4 ESCAPE '\\')
       ORDER BY tk.id ASC
       LIMIT $5`,
      [STAFF_ROLES, vai_tro ?? null, trang_thai ?? null, like, limit]
    );
    return res.json({ success: true, data: { items: r.rows.map(toAccount) } });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// GET /api/admin/accounts/:id
const getOne = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id tài khoản không hợp lệ");
    const acc = await getAccount(pool, id);
    if (!acc) return fail(res, 404, "Không tìm thấy tài khoản nhân viên");
    return res.json({ success: true, data: acc });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// POST /api/admin/accounts  { ten_dang_nhap, password, vai_tro, bac_si_id? }
const createAccount = async (req, res) => {
  let client;
  try {
    if (!requireAdmin(req, res)) return;
    const b = req.body;
    if (!isObj(b)) return fail(res, 400, "Body không hợp lệ");

    const err = checkUsername(b.ten_dang_nhap) || checkPassword(b.password) || checkRole(b.vai_tro);
    if (err) return fail(res, 400, err);
    const username = b.ten_dang_nhap.trim();
    const role = b.vai_tro.trim();

    let bacSiId = null;
    if (b.bac_si_id !== undefined && b.bac_si_id !== null) {
      if (role !== "Bác sĩ") return fail(res, 400, "bac_si_id chỉ dùng cho tài khoản vai trò Bác sĩ");
      if (!Number.isInteger(b.bac_si_id) || b.bac_si_id < 1 || b.bac_si_id > INT_MAX) {
        return fail(res, 400, "bac_si_id không hợp lệ");
      }
      bacSiId = b.bac_si_id;
    }

    const hash = await bcrypt.hash(b.password, 10);

    client = await pool.connect();
    await client.query("BEGIN");
    const abort = async (status, message, code) => {
      await client.query("ROLLBACK");
      return fail(res, status, message, code);
    };

    const dup = await client.query(`SELECT 1 FROM "TaiKhoan" WHERE LOWER(ten_dang_nhap) = LOWER($1)`, [username]);
    if (dup.rowCount > 0) return abort(409, "Tên đăng nhập đã tồn tại", "DUPLICATE_USERNAME");

    const role_ = await client.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = $1`, [role]);
    if (role_.rowCount === 0) return abort(400, "vai_tro không tồn tại trong hệ thống");

    if (bacSiId) {
      const bs = await client.query(`SELECT id, tai_khoan_id FROM "BacSi" WHERE id = $1 FOR UPDATE`, [bacSiId]);
      if (bs.rowCount === 0) return abort(400, "bac_si_id không tồn tại");
      if (bs.rows[0].tai_khoan_id) return abort(409, "Bác sĩ này đã có tài khoản", "BACSI_ALREADY_LINKED");
    }

    const ins = await client.query(
      `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, vai_tro_id, trang_thai) VALUES ($1,$2,$3,$4) RETURNING id`,
      [username, hash, role_.rows[0].id, ST_ACTIVE]
    );
    const newId = ins.rows[0].id;
    if (bacSiId) await client.query(`UPDATE "BacSi" SET tai_khoan_id = $1 WHERE id = $2`, [newId, bacSiId]);

    await client.query("COMMIT");
    return res.status(201).json({ success: true, data: await getAccount(pool, newId) });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") return fail(res, 409, "Tên đăng nhập đã tồn tại", "DUPLICATE_USERNAME");
    console.error(err);
    return fail(res, 500, "Lỗi server");
  } finally {
    if (client) client.release();
  }
};

// PUT /api/admin/accounts/:id  { ten_dang_nhap?, password?, vai_tro? }  (gửi field nào sửa field đó)
const updateAccount = async (req, res) => {
  let client;
  try {
    if (!requireAdmin(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id tài khoản không hợp lệ");
    const b = req.body;
    if (!isObj(b)) return fail(res, 400, "Body không hợp lệ");

    const has = (k) => b[k] !== undefined;
    if (!has("ten_dang_nhap") && !has("password") && !has("vai_tro")) {
      return fail(res, 400, "Cần gửi ít nhất một trong: ten_dang_nhap, password, vai_tro");
    }
    const err =
      (has("ten_dang_nhap") && checkUsername(b.ten_dang_nhap)) ||
      (has("password") && checkPassword(b.password)) ||
      (has("vai_tro") && checkRole(b.vai_tro));
    if (err) return fail(res, 400, err);

    const hash = has("password") ? await bcrypt.hash(b.password, 10) : null;

    client = await pool.connect();
    await client.query("BEGIN");
    const abort = async (status, message, code) => {
      await client.query("ROLLBACK");
      return fail(res, status, message, code);
    };

    const cur = await client.query(
      `SELECT tk.id, vt.ten_vai_tro FROM "TaiKhoan" tk JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id
       WHERE tk.id = $1 AND vt.ten_vai_tro = ANY($2::text[]) FOR UPDATE OF tk`,
      [id, STAFF_ROLES]
    );
    if (cur.rowCount === 0) return abort(404, "Không tìm thấy tài khoản nhân viên");

    const sets = [];
    const params = [];
    const add = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (has("ten_dang_nhap")) {
      const username = b.ten_dang_nhap.trim();
      const dup = await client.query(`SELECT 1 FROM "TaiKhoan" WHERE LOWER(ten_dang_nhap) = LOWER($1) AND id <> $2`, [username, id]);
      if (dup.rowCount > 0) return abort(409, "Tên đăng nhập đã tồn tại", "DUPLICATE_USERNAME");
      add("ten_dang_nhap", username);
    }
    if (has("password")) add("mat_khau", hash);
    if (has("vai_tro")) {
      const newRole = b.vai_tro.trim();
      if (newRole !== cur.rows[0].ten_vai_tro) {
        if (cur.rows[0].ten_vai_tro === "Bác sĩ") {
          const linked = await client.query(`SELECT 1 FROM "BacSi" WHERE tai_khoan_id = $1`, [id]);
          if (linked.rowCount > 0) return abort(409, "Tài khoản đang gắn với hồ sơ bác sĩ, không đổi vai trò được", "ROLE_LINKED");
        }
        const rid = await client.query(`SELECT id FROM "VaiTro" WHERE ten_vai_tro = $1`, [newRole]);
        if (rid.rowCount === 0) return abort(400, "vai_tro không tồn tại trong hệ thống");
        add("vai_tro_id", rid.rows[0].id);
      }
    }

    if (sets.length > 0) {
      params.push(id);
      await client.query(`UPDATE "TaiKhoan" SET ${sets.join(", ")} WHERE id = $${params.length}`, params);
    }
    await client.query("COMMIT");
    return res.json({ success: true, data: await getAccount(pool, id) });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") return fail(res, 409, "Tên đăng nhập đã tồn tại", "DUPLICATE_USERNAME");
    console.error(err);
    return fail(res, 500, "Lỗi server");
  } finally {
    if (client) client.release();
  }
};

// PATCH /api/admin/accounts/:id/status  { trang_thai: "HoatDong" | "BiKhoa" }
const setStatus = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id tài khoản không hợp lệ");
    if (req.user.id === id) return fail(res, 400, "Không thể tự khóa tài khoản của chính mình", "CANNOT_LOCK_SELF");
    const b = req.body;
    if (!isObj(b) || typeof b.trang_thai !== "string" || !VALID_STATES.includes(b.trang_thai)) {
      return fail(res, 400, `trang_thai phải thuộc: ${VALID_STATES.join(", ")}`);
    }

    const upd = await pool.query(
      `UPDATE "TaiKhoan" tk SET trang_thai = $2
       FROM "VaiTro" vt
       WHERE tk.id = $1 AND vt.id = tk.vai_tro_id AND vt.ten_vai_tro = ANY($3::text[])
       RETURNING tk.id`,
      [id, b.trang_thai, STAFF_ROLES]
    );
    if (upd.rowCount === 0) return fail(res, 404, "Không tìm thấy tài khoản nhân viên");
    return res.json({ success: true, data: await getAccount(pool, id) });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = { listAccounts, getOne, createAccount, updateAccount, setStatus };