import { apiClient } from "./client";

// C4-06: backend/src/controllers/labOrder.controller.js
export const labOrderPaths = {
  // GET -> { data: { ho_so: { id, trang_thai }, tong, chi_dinh: [...] } } (cũ nhất trước)
  list: (hoSoId) => `/api/lab-orders?ho_so_id=${encodeURIComponent(hoSoId)}`,
  // GET -> { data: [{ id, ten_phong, loai_phong, chuyen_khoa_id, ten_chuyen_khoa }] }
  // Backend chưa có API riêng cho phòng xét nghiệm: lấy tất cả phòng rồi lọc theo loai_phong ở frontend.
  rooms: () => "/api/master/phong-kham",
};

export const labOrderApi = {
  // body: { ho_so_id, phong_kham_id, ten_xet_nghiem, ghi_chu? }
  // 201 -> { data: { chi_dinh: { id, ho_so_id, phong_kham_id, phong, ten_xet_nghiem, ghi_chu, trang_thai, thoi_gian_chi_dinh } } }
  // Lỗi: 400 dữ liệu sai | 403 không phải chủ hồ sơ | 404 không có hồ sơ | 409 hồ sơ không còn DANG_KHAM
  create: (body) => apiClient.post("/api/lab-orders", body),
};
