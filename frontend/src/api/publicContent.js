// C6-10: API công khai (không cần đăng nhập). Backend: backend/src/controllers/publicContent.controller.js
// Dữ liệu do Admin C6-09 quản lý (bảng TinTuc, QuyTrinhKham).
export const publicContentApi = {
  // GET -> { data: [{ id, tieu_de, ngay_dang }] }  chỉ tin HienThi, mới nhất trước
  newsPath: () => "/api/public/news",
  // GET -> { data: { id, tieu_de, noi_dung, ngay_dang } }
  // 404 nếu không tồn tại HOẶC tin đã ẩn; 400 nếu id sai định dạng
  newsDetailPath: (id) => `/api/public/news/${encodeURIComponent(id)}`,
  // GET -> { data: [{ id, thu_tu, tieu_de_buoc, mo_ta }] }  thu_tu tăng dần; chưa có dữ liệu -> []
  procedurePath: () => "/api/public/procedure-steps",
};
