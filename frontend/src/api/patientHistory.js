import { apiClient } from "./client";

// C6-11: backend/src/controllers/patientMedicalRecord.controller.js
// Backend tự xác định Bệnh nhân từ token đăng nhập; chỉ trả hồ sơ DA_XONG của chính người đó.
export const historyApi = {
  // GET -> { data: [{ ho_so_id, ngay_kham, doctor{id,ho_ten,cap_bac}|null, chuyen_khoa{id,ten_chuyen_khoa}|null, so_xet_nghiem }] }
  // Mới nhất trước; chưa có lịch sử -> []
  listPath: () => "/api/patient/medical-records",
  // GET -> { data: { ho_so, doctor, chuyen_khoa, ket_qua_kham{trieu_chung,chan_doan,loi_dan,don_thuoc},
  //                  xet_nghiem: [{ id, ten_xet_nghiem, trang_thai, thoi_gian_hoan_thanh, mo_ta, file{file_type,file_url}|null }] } }
  // Hồ sơ của người khác / chưa hoàn tất / không tồn tại -> 404 (cùng một thông báo)
  detailPath: (id) => `/api/patient/medical-records/${encodeURIComponent(id)}`,
  // Mở file kết quả xét nghiệm (cần Authorization nên tải về Blob). fileUrl = xet_nghiem[].file.file_url
  getLabFile: (fileUrl) => apiClient.getBlob(fileUrl),
};
