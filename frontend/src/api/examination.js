import { apiClient } from "./client";

// C4-02: API đọc hồ sơ khám (chỉ vai trò Bác sĩ, chỉ đọc, không lưu)
export const examinationPaths = {
  // -> { data: { ho_so, patient, queue, doctor, room, appointment, ket_qua_kham } }
  record: (hoSoId) => `/api/examinations/${encodeURIComponent(hoSoId)}`,
  // -> { data: { ho_so_id, benh_nhan_id, history: [...] } }; limit mặc định 20, tối đa 50
  history: (hoSoId, limit = 20) =>
    `/api/examinations/${encodeURIComponent(hoSoId)}/history?limit=${limit}`,
};

export const examinationApi = {
  getRecord: (hoSoId) => apiClient.get(examinationPaths.record(hoSoId)),
  getHistory: (hoSoId, limit) => apiClient.get(examinationPaths.history(hoSoId, limit)),
};