const pool = require("../config/db");

// C5-02: phòng xét nghiệm. Chỉ xem danh sách / chi tiết / bắt đầu xử lý chỉ định.
// KHÔNG upload kết quả (C5-03), KHÔNG notification, KHÔNG sửa C4-06 (tạo chỉ định của bác sĩ).

const ROLE_XET_NGHIEM = "Xét nghiệm";
const ST_CHO = "CHO_XU_LY";
const ST_DANG = "DANG_XU_LY";
const ST_XONG = "DA_XONG";
const VALID_STATES = [ST_CHO, ST_DANG, ST_XONG];
const INT_MAX = 2147483647;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

const fail = (res, status, message, code, data) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}), ...(data ? { data } : {}) });

// Chỉ role Xét nghiệm; phòng lấy từ TaiKhoan.phong_kham_id (KHÔNG tin phong_kham_id từ client)
const getStaffRoom = async (db, req, res) => {
  if (!req.user || req.user.role !== ROLE_XET_NGHIEM) {
    fail(res, 403, "Chỉ nhân viên phòng xét nghiệm mới được thực hiện thao tác này");
    return null;
  }
  const r = await db.query(`SELECT phong_kham_id FROM "TaiKhoan" WHERE id = $1`, [req.user.id]);
  const roomId = r.rows[0]?.phong_kham_id;
  if (!roomId) {
    fail(res, 403, "Tài khoản chưa được gán phòng xét nghiệm");
    return null;
  }
  return roomId;
};

const BASE_SELECT = `
  SELECT c.id AS chi_dinh_id, c.ho_so_id, c.trang_thai,
         c.ten_xet_nghiem, c.ghi_chu, c.thoi_gian_chi_dinh,
         c.nhan_vien_xu_ly_id, c.thoi_gian_bat_dau,
         c.phong_kham_id, pk.ten_phong,
         hs.id AS hs_id, to_char(hs.ngay_kham, 'YYYY-MM-DD') AS hs_ngay_kham, hs.trang_thai AS hs_trang_thai,
         bn.id AS bn_id, bn.ho_ten AS bn_ho_ten, to_char(bn.ngay_sinh, 'YYYY-MM-DD') AS bn_ngay_sinh, bn.gioi_tinh,
         bs.id AS bs_id, bs.ho_ten AS bs_ho_ten,
         nv.ten_dang_nhap AS nv_username
  FROM "ChiDinhXetNghiem" c
  JOIN "HoSoBenhAn" hs ON hs.id = c.ho_so_id
  JOIN "BenhNhan" bn ON bn.id = hs.benh_nhan_id
  LEFT JOIN "HangDoi" h ON h.id = hs.hang_doi_id
  LEFT JOIN "BacSi" bs ON bs.id = COALESCE(hs.bac_si_id, h.bac_si_id)
  LEFT JOIN "PhongKham" pk ON pk.id = c.phong_kham_id
  LEFT JOIN "TaiKhoan" nv ON nv.id = c.nhan_vien_xu_ly_id`;

const toItem = (r) => ({
  chi_dinh_id: r.chi_dinh_id,
  ho_so_id: r.ho_so_id,
  trang_thai: r.trang_thai,
  ten_xet_nghiem: r.ten_xet_nghiem,
  ghi_chu: r.ghi_chu,
  thoi_gian_chi_dinh: r.thoi_gian_chi_dinh,
  patient: { id: r.bn_id, ho_ten: r.bn_ho_ten },
  room: { id: r.phong_kham_id, ten_phong: r.ten_phong },
});

const toDetail = (r) => ({
  ...toItem(r),
  patient: { id: r.bn_id, ho_ten: r.bn_ho_ten, ngay_sinh: r.bn_ngay_sinh, gioi_tinh: r.gioi_tinh },
  ho_so: { id: r.hs_id, ngay_kham: r.hs_ngay_kham, trang_thai: r.hs_trang_thai },
  doctor: r.bs_id ? { id: r.bs_id, ho_ten: r.bs_ho_ten } : null,
  xu_ly: {
    nhan_vien: r.nhan_vien_xu_ly_id ? { id: r.nhan_vien_xu_ly_id, ten_dang_nhap: r.nv_username } : null,
    thoi_gian_bat_dau: r.thoi_gian_bat_dau,
  },
});

// GET /api/lab/orders?trang_thai=CHO_XU_LY[,DANG_XU_LY,DA_XONG]&limit=
const listOrders = async (req, res) => {
  try {
    const roomId = await getStaffRoom(pool, req, res);
    if (!roomId) return;

    let states = null;
    if (req.query.trang_thai !== undefined) {
      if (typeof req.query.trang_thai !== "string") return fail(res, 400, "trang_thai không hợp lệ");
      states = req.query.trang_thai.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (states.length === 0 || states.some((s) => !VALID_STATES.includes(s))) {
        return fail(res, 400, `trang_thai phải thuộc: ${VALID_STATES.join(", ")}`);
      }
    }

    let limit = DEFAULT_LIMIT;
    if (req.query.limit !== undefined) {
      if (typeof req.query.limit !== "string" || !/^\d{1,3}$/.test(req.query.limit)) {
        return fail(res, 400, `limit phải từ 1 đến ${MAX_LIMIT}`);
      }
      limit = Number(req.query.limit);
      if (limit < 1 || limit > MAX_LIMIT) return fail(res, 400, `limit phải từ 1 đến ${MAX_LIMIT}`);
    }

    const room = await pool.query(`SELECT id, ten_phong FROM "PhongKham" WHERE id = $1`, [roomId]);
    const r = await pool.query(
      `${BASE_SELECT}
       WHERE c.phong_kham_id = $1 AND ($2::text[] IS NULL OR c.trang_thai = ANY($2))
       ORDER BY c.thoi_gian_chi_dinh ASC, c.id ASC
       LIMIT $3`,
      [roomId, states, limit]
    );
    return res.json({
      success: true,
      data: { room: room.rows[0] || { id: roomId, ten_phong: null }, items: r.rows.map(toItem) },
    });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

// GET /api/lab/orders/:id  (chỉ đọc, không đổi trạng thái)
const getOrder = async (req, res) => {
  try {
    const roomId = await getStaffRoom(pool, req, res);
    if (!roomId) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id chỉ định không hợp lệ");

    const r = await pool.query(`${BASE_SELECT} WHERE c.id = $1`, [id]);
    if (r.rowCount === 0) return fail(res, 404, "Không tìm thấy chỉ định xét nghiệm");
    if (r.rows[0].phong_kham_id !== roomId) {
      return fail(res, 403, "Chỉ định này không thuộc phòng xét nghiệm của bạn");
    }
    return res.json({ success: true, data: toDetail(r.rows[0]) });
  } catch (err) {
    console.error(err);
    return fail(res, 500, "Lỗi server");
  }
};

const STATE_MESSAGES = {
  [ST_DANG]: "Chỉ định đang được xử lý",
  [ST_XONG]: "Chỉ định đã hoàn thành",
};

// POST /api/lab/orders/:id/start : CHO_XU_LY -> DANG_XU_LY
const startProcessing = async (req, res) => {
  let client;
  try {
    const roomId = await getStaffRoom(pool, req, res);
    if (!roomId) return;
    const id = parseId(req.params.id);
    if (!id) return fail(res, 400, "id chỉ định không hợp lệ");

    client = await pool.connect();
    await client.query("BEGIN");
    const abort = async (status, message, code, data) => {
      await client.query("ROLLBACK");
      return fail(res, status, message, code, data);
    };

    // Khóa dòng: hai request start cùng lúc chỉ một request thành công
    const lock = await client.query(
      `SELECT id, phong_kham_id, trang_thai FROM "ChiDinhXetNghiem" WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (lock.rowCount === 0) return abort(404, "Không tìm thấy chỉ định xét nghiệm");
    const row = lock.rows[0];
    if (row.phong_kham_id !== roomId) {
      return abort(403, "Chỉ định này không thuộc phòng xét nghiệm của bạn");
    }
    if (row.trang_thai !== ST_CHO) {
      return abort(
        409,
        STATE_MESSAGES[row.trang_thai] || "Chỉ định không ở trạng thái có thể bắt đầu xử lý",
        "INVALID_STATE",
        { trang_thai: row.trang_thai }
      );
    }

    // nhan_vien_xu_ly_id = nhân viên đăng nhập (lấy từ token, không lấy từ body)
    const upd = await client.query(
      `UPDATE "ChiDinhXetNghiem"
       SET trang_thai = $2, nhan_vien_xu_ly_id = $3, thoi_gian_bat_dau = NOW()
       WHERE id = $1 AND trang_thai = $4
       RETURNING id`,
      [id, ST_DANG, req.user.id, ST_CHO]
    );
    if (upd.rowCount === 0) return abort(409, "Chỉ định vừa được xử lý, vui lòng thử lại", "INVALID_STATE");

    const d = await client.query(`${BASE_SELECT} WHERE c.id = $1`, [id]);
    await client.query("COMMIT");
    return res.json({ success: true, data: toDetail(d.rows[0]) });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    return fail(res, 500, "Lỗi server");
  } finally {
    if (client) client.release();
  }
};

module.exports = { listOrders, getOrder, startProcessing };