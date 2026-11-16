const pool = require("../config/db");

// C6-10 — API CÔNG KHAI (không đăng nhập): Tin tức (UC-035) và Quy trình khám (UC-036).
// Dữ liệu lấy từ bảng TinTuc / QuyTrinhKham do Admin C6-09 quản lý. Query riêng, KHÔNG dùng Admin endpoint.
// Contract C6-09:
//   TinTuc: id, tieu_de, noi_dung, ngay_dang, trang_thai ("HienThi" | "An")
//   QuyTrinhKham: id, tieu_de_buoc, mo_ta, thu_tu (tăng dần; có thể có khoảng trống, không đánh số lại)

const TT_HIEN_THI = "HienThi";
const INT_MAX = 2147483647;

// Admin đổi nội dung thì người dùng phải thấy ngay khi tải lại trang: không cho cache phản hồi
const noStore = (res) => res.set("Cache-Control", "no-store");

const parseId = (v) => {
  if (typeof v !== "string" || !/^[1-9]\d{0,9}$/.test(v)) return null;
  const n = Number(v);
  return n <= INT_MAX ? n : null;
};

// GET /api/public/news
// Chỉ tin "HienThi", mới nhất trước (ngay_dang giảm dần, rồi id giảm dần). Không trả noi_dung / trang_thai.
const listNews = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, tieu_de, ngay_dang
       FROM "TinTuc"
       WHERE trang_thai = $1
       ORDER BY ngay_dang DESC NULLS LAST, id DESC`,
      [TT_HIEN_THI]
    );
    noStore(res);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Lỗi listNews:", err.message);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/public/news/:id
// Tin không tồn tại và tin đã "An" cho cùng một phản hồi 404 (không tiết lộ tin ẩn có tồn tại).
const getNewsDetail = async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "id tin tức không hợp lệ" });

  try {
    const result = await pool.query(
      `SELECT id, tieu_de, noi_dung, ngay_dang
       FROM "TinTuc"
       WHERE id = $1 AND trang_thai = $2`,
      [id, TT_HIEN_THI]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy tin tức" });
    }
    noStore(res);
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Lỗi getNewsDetail:", err.message);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

// GET /api/public/procedure-steps
// Các bước quy trình khám, thu_tu tăng dần. Chưa có dữ liệu -> data = [] (không lỗi).
const listProcedureSteps = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, thu_tu, tieu_de_buoc, mo_ta
       FROM "QuyTrinhKham"
       ORDER BY thu_tu ASC, id ASC`
    );
    noStore(res);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("Lỗi listProcedureSteps:", err.message);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

module.exports = { listNews, getNewsDetail, listProcedureSteps };
