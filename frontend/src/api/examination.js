import { apiClient } from "./client";

// C4-02: API đọc hồ sơ khám (chỉ vai trò Bác sĩ, chỉ đọc, không lưu)
export const examinationPaths = {
  // -> { data: { ho_so, patient, queue, doctor, room, appointment, ket_qua_kham } }
  record: (hoSoId) => `/api/examinations/${encodeURIComponent(hoSoId)}`,
  // -> { data: { ho_so_id, benh_nhan_id, history: [...] } }; limit mặc định 20, tối đa 50
  history: (hoSoId, limit = 20) =>
    `/api/examinations/${encodeURIComponent(hoSoId)}/history?limit=${limit}`,
  // C4-04: lưu/cập nhật kết quả khám (chỉ khi hồ sơ DANG_KHAM, đúng bác sĩ chủ hồ sơ)
  // body: { trieu_chung_ghi_nhan?, chan_doan?, loi_dan?, don_thuoc? } (gửi trường nào cập nhật trường đó)
  // -> { message, data: { ho_so: { id, trang_thai }, ket_qua_kham: { id, 4 trường } } }
  result: (hoSoId) => `/api/examinations/${encodeURIComponent(hoSoId)}/result`,
};

export const examinationApi = {
  getRecord: (hoSoId) => apiClient.get(examinationPaths.record(hoSoId)),
  getHistory: (hoSoId, limit) => apiClient.get(examinationPaths.history(hoSoId, limit)),
  saveResult: (hoSoId, body) => apiClient.put(examinationPaths.result(hoSoId), body),
};