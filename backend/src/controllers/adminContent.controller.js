const pool = require("../config/db");

// C6-09: Admin quản lý Tin tức (TinTuc) và Quy trình khám (QuyTrinhKham).
// Dùng trực tiếp 2 bảng hiện có, không đổi schema, không làm Public API (C6-10), không upload media.

const ROLE_ADMIN = "Quản trị viên";

// ===== KIỂM TRA bằng scripts/check-c6-09.js rồi sửa cho khớp DB thật =====
const STATUS = { SHOW: "HienThi", HIDE: "An" }; // giá trị TinTuc.trang_thai (Hiển thị / Ẩn)
const TITLE_MAX = 255;
const CONTENT_MAX = 50000;
const MO_TA_MAX = 5000;
const MO_TA_REQUIRED = true; // false nếu đặc tả cho phép bước không có mô tả
const THU_TU_MAX = 32767; // an toàn cho cả smallint và integer
// =========================================================================

const VALID_STATUS = [STATUS.SHOW, STATUS.HIDE];
const INT_MAX = 2147483647;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const STEP_LOCK_KEY = 6090901; // advisory lock: tuần tự hóa tạo/sửa thứ tự bước

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

// Trả message lỗi nếu sai, ngược lại null
const textErr = (v, name, max) => {
  if (typeof v !== "string") return `${name} phải là chuỗi`;
  const t = v.trim();
  if (!t) return `${name} là bắt buộc`;
  if (t.length > max) return `${name} tối đa ${max} ký tự`;
  return null;
};
const statusErr = (v) => (VALID_STATUS.includes(v) ? null : `trang_thai phải thuộc: ${VALID_STATUS.join(", ")}`);
const dateErr = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v) &&
  !Number.isNaN(Date.parse(v))
    ? null
    : "ngay_dang không hợp lệ (định dạng YYYY-MM-DD hoặc ISO)";
const moTaErr = (v) => {
  if (MO_TA_REQUIRED) return textErr(v, "mo_ta", MO_TA_MAX);
  if (v === null) return null;
  if (typeof v !== "string") return "mo_ta phải là chuỗi";
  return v.trim().length > MO_TA_MAX ? `mo_ta tối đa ${MO_TA_MAX} ký tự` : null;
};
const parseOrder = (v) => {
  let n = v;
  if (typeof v === "string" && /^[1-9]\d{0,5}$/.test(v)) n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= THU_TU_MAX ? n : null;
};

const handleDbError = (res, err) => {
  if (err.code === "22001") return fail(res, 400, "Dữ liệu vượt quá độ dài cho phép");
  if (err.code === "23505") return fail(res, 409, "Thứ tự đã tồn tại", "DUPLICATE_ORDER");
  console.error(err);
  return fail(res, 500, "Lỗi server");
};

// ================= TIN TỨC =================
const NEWS_COLS = `id, tieu_de, noi_dung, ngay_dang, trang_thai`;

// GET /api/admin/content/news?trang_thai=&q=&limit=
const listNews = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { trang_thai, q } = req.query;
    if (trang_thai !== undefined && (typeof trang_thai !== "string" || statusErr(trang_thai))) {
      return fail(res, 400, `trang_thai phải thuộc: ${VALID_STATUS.join(", ")}`);
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
      `SELECT ${NEWS_COLS} FROM "TinTuc"
       WHERE ($1::text IS NULL OR trang_thai = $1)
         AND ($2::text IS NULL OR tieu_de ILIKE $2 ESCAPE '\\')
       ORDER BY ngay_dang DESC NULLS LAST, id DESC
       LIMIT $3`,
      [trang_thai ?? null, like, limit]
    );
    return res.json({ success: true, data: { items: r.rows } });
  } catch (err) {
    return handleDbError(res, err);
  }
};

// GET /api/admin/content/news/:id
const getNews = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id tin tức không hợp lệ");
    const r = await pool.query(`SELECT ${NEWS_COLS} FROM "TinTuc" WHERE id = $1`, [id]);
    if (r.rowCount === 0) return fail(res, 404, "Không tìm thấy tin tức");
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    return handleDbError(res, err);
  }
};

// POST /api/admin/content/news { tieu_de, noi_dung, ngay_dang?, trang_thai? }
const createNews = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const b = req.body;
    if (!isObj(b)) return fail(res, 400, "Body không hợp lệ");
    const err =
      textErr(b.tieu_de, "tieu_de", TITLE_MAX) ||
      textErr(b.noi_dung, "noi_dung", CONTENT_MAX) ||
      (b.trang_thai !== undefined && statusErr(b.trang_thai)) ||
      (b.ngay_dang !== undefined && b.ngay_dang !== null && dateErr(b.ngay_dang));
    if (err) return fail(res, 400, err);

    const r = await pool.query(
      `INSERT INTO "TinTuc" (tieu_de, noi_dung, ngay_dang, trang_thai)
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4)
       RETURNING ${NEWS_COLS}`,
      [b.tieu_de.trim(), b.noi_dung.trim(), b.ngay_dang ?? null, b.trang_thai ?? STATUS.SHOW]
    );
    return res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    return handleDbError(res, err);
  }
};

// PUT /api/admin/content/news/:id  (gửi field nào sửa field đó)
const updateNews = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id tin tức không hợp lệ");
    const b = req.body;
    if (!isObj(b)) return fail(res, 400, "Body không hợp lệ");
    const has = (k) => b[k] !== undefined;
    if (!["tieu_de", "noi_dung", "ngay_dang", "trang_thai"].some(has)) {
      return fail(res, 400, "Cần gửi ít nhất một trong: tieu_de, noi_dung, ngay_dang, trang_thai");
    }
    const err =
      (has("tieu_de") && textErr(b.tieu_de, "tieu_de", TITLE_MAX)) ||
      (has("noi_dung") && textErr(b.noi_dung, "noi_dung", CONTENT_MAX)) ||
      (has("trang_thai") && statusErr(b.trang_thai)) ||
      (has("ngay_dang") && dateErr(b.ngay_dang));
    if (err) return fail(res, 400, err);

    const sets = [];
    const params = [];
    const add = (expr, val) => {
      params.push(val);
      sets.push(expr.replace("?", `$${params.length}`));
    };
    if (has("tieu_de")) add("tieu_de = ?", b.tieu_de.trim());
    if (has("noi_dung")) add("noi_dung = ?", b.noi_dung.trim());
    if (has("ngay_dang")) add("ngay_dang = ?::timestamptz", b.ngay_dang);
    if (has("trang_thai")) add("trang_thai = ?", b.trang_thai);
    params.push(id);

    const r = await pool.query(`UPDATE "TinTuc" SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${NEWS_COLS}`, params);
    if (r.rowCount === 0) return fail(res, 404, "Không tìm thấy tin tức");
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    return handleDbError(res, err);
  }
};

// PATCH /api/admin/content/news/:id/status { trang_thai }
const setNewsStatus = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id tin tức không hợp lệ");
    const b = req.body;
    if (!isObj(b) || statusErr(b.trang_thai)) return fail(res, 400, `trang_thai phải thuộc: ${VALID_STATUS.join(", ")}`);
    const r = await pool.query(`UPDATE "TinTuc" SET trang_thai = $2 WHERE id = $1 RETURNING ${NEWS_COLS}`, [id, b.trang_thai]);
    if (r.rowCount === 0) return fail(res, 404, "Không tìm thấy tin tức");
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    return handleDbError(res, err);
  }
};

// DELETE /api/admin/content/news/:id
const deleteNews = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id tin tức không hợp lệ");
    const r = await pool.query(`DELETE FROM "TinTuc" WHERE id = $1 RETURNING id`, [id]);
    if (r.rowCount === 0) return fail(res, 404, "Không tìm thấy tin tức");
    return res.json({ success: true, message: "Đã xóa tin tức", data: { id } });
  } catch (err) {
    return handleDbError(res, err);
  }
};

// ================= QUY TRÌNH KHÁM =================
const STEP_COLS = `id, tieu_de_buoc, mo_ta, thu_tu`;

// GET /api/admin/content/procedure-steps  (luôn sắp xếp thu_tu tăng dần)
const listSteps = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const r = await pool.query(`SELECT ${STEP_COLS} FROM "QuyTrinhKham" ORDER BY thu_tu ASC, id ASC`);
    return res.json({ success: true, data: { items: r.rows } });
  } catch (err) {
    return handleDbError(res, err);
  }
};

// POST /api/admin/content/procedure-steps { tieu_de_buoc, mo_ta, thu_tu? }  (không gửi thu_tu -> tự lấy max + 1)
const createStep = async (req, res) => {
  let client;
  try {
    if (!requireAdmin(req, res)) return;
    const b = req.body;
    if (!isObj(b)) return fail(res, 400, "Body không hợp lệ");
    let order = null;
    if (b.thu_tu !== undefined && b.thu_tu !== null) {
      order = parseOrder(b.thu_tu);
      if (order === null) return fail(res, 400, `thu_tu phải là số nguyên từ 1 đến ${THU_TU_MAX}`);
    }
    const err = textErr(b.tieu_de_buoc, "tieu_de_buoc", TITLE_MAX) || (b.mo_ta !== undefined ? moTaErr(b.mo_ta) : MO_TA_REQUIRED ? "mo_ta là bắt buộc" : null);
    if (err) return fail(res, 400, err);

    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [STEP_LOCK_KEY]);

    if (order === null) {
      order = Number((await client.query(`SELECT COALESCE(MAX(thu_tu), 0) + 1 AS n FROM "QuyTrinhKham"`)).rows[0].n);
      if (order > THU_TU_MAX) {
        await client.query("ROLLBACK");
        return fail(res, 400, "Không còn thứ tự trống để tự động gán, hãy nhập thu_tu");
      }
    } else if ((await client.query(`SELECT 1 FROM "QuyTrinhKham" WHERE thu_tu = $1`, [order])).rowCount > 0) {
      await client.query("ROLLBACK");
      return fail(res, 409, "thu_tu đã tồn tại", "DUPLICATE_ORDER");
    }

    const r = await client.query(
      `INSERT INTO "QuyTrinhKham" (tieu_de_buoc, mo_ta, thu_tu) VALUES ($1,$2,$3) RETURNING ${STEP_COLS}`,
      [b.tieu_de_buoc.trim(), typeof b.mo_ta === "string" ? b.mo_ta.trim() : null, order]
    );
    await client.query("COMMIT");
    return res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return handleDbError(res, err);
  } finally {
    if (client) client.release();
  }
};

// PUT /api/admin/content/procedure-steps/:id  (gửi field nào sửa field đó)
const updateStep = async (req, res) => {
  let client;
  try {
    if (!requireAdmin(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id bước không hợp lệ");
    const b = req.body;
    if (!isObj(b)) return fail(res, 400, "Body không hợp lệ");
    const has = (k) => b[k] !== undefined;
    if (!["tieu_de_buoc", "mo_ta", "thu_tu"].some(has)) {
      return fail(res, 400, "Cần gửi ít nhất một trong: tieu_de_buoc, mo_ta, thu_tu");
    }
    let order = null;
    if (has("thu_tu")) {
      order = parseOrder(b.thu_tu);
      if (order === null) return fail(res, 400, `thu_tu phải là số nguyên từ 1 đến ${THU_TU_MAX}`);
    }
    const err = (has("tieu_de_buoc") && textErr(b.tieu_de_buoc, "tieu_de_buoc", TITLE_MAX)) || (has("mo_ta") && moTaErr(b.mo_ta));
    if (err) return fail(res, 400, err);

    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [STEP_LOCK_KEY]);
    const abort = async (status, message, code) => {
      await client.query("ROLLBACK");
      return fail(res, status, message, code);
    };

    if ((await client.query(`SELECT 1 FROM "QuyTrinhKham" WHERE id = $1`, [id])).rowCount === 0) {
      return abort(404, "Không tìm thấy bước khám");
    }
    if (order !== null && (await client.query(`SELECT 1 FROM "QuyTrinhKham" WHERE thu_tu = $1 AND id <> $2`, [order, id])).rowCount > 0) {
      return abort(409, "thu_tu đã tồn tại", "DUPLICATE_ORDER");
    }

    const sets = [];
    const params = [];
    const add = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (has("tieu_de_buoc")) add("tieu_de_buoc", b.tieu_de_buoc.trim());
    if (has("mo_ta")) add("mo_ta", b.mo_ta === null ? null : b.mo_ta.trim());
    if (order !== null) add("thu_tu", order);
    params.push(id);
    const r = await client.query(`UPDATE "QuyTrinhKham" SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING ${STEP_COLS}`, params);
    await client.query("COMMIT");
    return res.json({ success: true, data: r.rows[0] });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    return handleDbError(res, err);
  } finally {
    if (client) client.release();
  }
};

// DELETE /api/admin/content/procedure-steps/:id  (không đánh số lại các bước còn lại)
const deleteStep = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id bước không hợp lệ");
    const r = await pool.query(`DELETE FROM "QuyTrinhKham" WHERE id = $1 RETURNING id`, [id]);
    if (r.rowCount === 0) return fail(res, 404, "Không tìm thấy bước khám");
    return res.json({ success: true, message: "Đã xóa bước khám", data: { id } });
  } catch (err) {
    return handleDbError(res, err);
  }
};

module.exports = {
  listNews, getNews, createNews, updateNews, setNewsStatus, deleteNews,
  listSteps, createStep, updateStep, deleteStep,
  STATUS, MO_TA_REQUIRED, THU_TU_MAX, TITLE_MAX,
};