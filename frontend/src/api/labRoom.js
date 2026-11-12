import { apiClient } from "./client";

// C5-02 + C5-03: API phòng xét nghiệm (chỉ role "Xét nghiệm").
// Phòng lấy từ tài khoản ở Backend: frontend KHÔNG gửi phong_kham_id.
const order = (id) => `/api/lab/orders/${encodeURIComponent(id)}`;

export const labRoomPaths = {
  // GET -> { data: { room: { id, ten_phong }, items: [...] } } (cũ nhất trước)
  // trangThai rỗng = tất cả trạng thái
  list: (trangThai) =>
    trangThai
      ? `/api/lab/orders?trang_thai=${encodeURIComponent(trangThai)}`
      : "/api/lab/orders",
  // GET -> { data: { ...item, patient, ho_so, doctor, xu_ly } }
  detail: (id) => order(id),
  // GET -> { data: { chi_dinh: {..., thoi_gian_hoan_thanh}, ket_qua: {...} | null } }
  result: (id) => `${order(id)}/result`,
  // GET -> file (cần Authorization)
  resultFile: (id) => `${order(id)}/result/file`,
};

export const labRoomApi = {
  // CHO_XU_LY -> DANG_XU_LY; trả về giống chi tiết. 409 INVALID_STATE nếu đã xử lý
  start: (id) => apiClient.post(`${order(id)}/start`),
  // multipart: file (PDF/JPG/PNG/WebP, <= 10MB), mo_ta (tùy chọn). DANG_XU_LY -> DA_XONG
  submitResult: (id, file, moTa) => {
    const form = new FormData();
    form.append("file", file);
    if (moTa && moTa.trim()) form.append("mo_ta", moTa.trim());
    return apiClient.post(`${order(id)}/result`, form);
  },
  getResultFile: (id) => apiClient.getBlob(labRoomPaths.resultFile(id)),
};