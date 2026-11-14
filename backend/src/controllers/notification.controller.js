const pool = require("../config/db");

// C5-05: bệnh nhân đọc thông báo của chính mình (bảng ThongBao).
// Thông báo do trigger trong DB tạo khi ChiDinhXetNghiem -> DA_XONG; API này chỉ ĐỌC và đánh dấu đã đọc.
// Không realtime push / SMS / email.

const ROLE_BENH_NHAN = "Bệnh nhân";
const MAX_LIST = 50;
const INT_MAX = 2147483647;

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const loadPatient = async (req, res) => {
  if (!req.user || req.user.role !== ROLE_BENH_NHAN) {
    fail(res, 403, "Chỉ bệnh nhân mới xem được thông báo");
    return null;
  }
  const r = await pool.query(`SELECT id FROM "BenhNhan" WHERE tai_khoan_id = $1`, [req.user.id]);
  if (r.rowCount === 0) {
    fail(res, 403, "Tài khoản chưa gắn với hồ sơ bệnh nhân");
    return null;
  }
  return r.rows[0].id;
};

const toThongBao = (r) => ({
  id: r.id,
  loai: r.loai,
  noi_dung: r.noi_dung,
  ho_so_id: r.ho_so_id,
  chi_dinh_id: r.chi_dinh_id,
  da_doc: r.da_doc,
  thoi_gian_tao: r.thoi_gian_tao,
});

// GET /api/notifications[?unread=1]  -> thông báo của bệnh nhân đang đăng nhập (mới nhất trước, tối đa 50)
const listNotifications = async (req, res) => {
  try {
    const bnId = await loadPatient(req, res);
    if (!bnId) return;
    const unreadOnly = req.query && (req.query.unread === "1" || req.query.unread === "true");

    const list = await pool.query(
      `SELECT id, loai, noi_dung, ho_so_id, chi_dinh_id, da_doc, thoi_gian_tao
       FROM "ThongBao"
       WHERE benh_nhan_id = $1 AND ($2::boolean = FALSE OR da_doc = FALSE)
       ORDER BY thoi_gian_tao DESC, id DESC
       LIMIT ${MAX_LIST}`,
      [bnId, unreadOnly]
    );
    const unread = await pool.query(
      `SELECT COUNT(*)::int AS n FROM "ThongBao" WHERE benh_nhan_id = $1 AND da_doc = FALSE`,
      [bnId]
    );
    return res.json({
      success: true,
      data: { chua_doc: unread.rows[0].n, thong_bao: list.rows.map(toThongBao) },
    });
  } catch (err) {
    console.error("Lỗi listNotifications:", err);
    return fail(res, 500, "Lỗi server");
  }
};

// PATCH /api/notifications/:id/read  -> đánh dấu đã đọc (chỉ thông báo của chính mình)
const markRead = async (req, res) => {
  try {
    const bnId = await loadPatient(req, res);
    if (!bnId) return;
    const raw = req.params.id;
    if (typeof raw !== "string" || !/^[1-9]\d{0,9}$/.test(raw) || Number(raw) > INT_MAX) {
      return fail(res, 400, "id thông báo không hợp lệ");
    }
    // Thông báo của người khác trả 404 (không tiết lộ là có tồn tại)
    const upd = await pool.query(
      `UPDATE "ThongBao" SET da_doc = TRUE
       WHERE id = $1 AND benh_nhan_id = $2
       RETURNING id, loai, noi_dung, ho_so_id, chi_dinh_id, da_doc, thoi_gian_tao`,
      [Number(raw), bnId]
    );
    if (upd.rowCount === 0) return fail(res, 404, "Không tìm thấy thông báo");
    return res.json({ success: true, data: { thong_bao: toThongBao(upd.rows[0]) } });
  } catch (err) {
    console.error("Lỗi markRead:", err);
    return fail(res, 500, "Lỗi server");
  }
};

module.exports = { listNotifications, markRead };
