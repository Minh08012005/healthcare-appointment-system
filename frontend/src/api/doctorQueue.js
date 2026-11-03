import { apiClient } from "./client";

// C3-08: POST /api/queue/next
// C3-09: GET /api/queue/current,
//        POST /api/queue/:id/skip, POST /api/queue/:id/start
// Frontend không chọn bệnh nhân, không tính 1A:1B: chỉ gọi API và hiển thị kết quả.
export const doctorQueueApi = {
  // -> { data: { has_calling, queue, patient, appointment, room, trieu_chung } }
  getCurrent: () => apiClient.get("/api/queue/current"),
  // -> { data: { called, message, room_id?, queue, patient, appointment, room } }
  // 409 ALREADY_CALLING khi bác sĩ đang có bệnh nhân DANG_GOI
  callNext: () => apiClient.post("/api/queue/next"),
  // -> { message, data: { id, trang_thai: BO_LUOT | VANG_MAT, so_lan_bo_luot } }
  skip: (queueId) =>
    apiClient.post(`/api/queue/${encodeURIComponent(queueId)}/skip`),
  // -> { message, data: { queue_id, trang_thai: DANG_KHAM, ho_so_id } }
  start: (queueId) =>
    apiClient.post(`/api/queue/${encodeURIComponent(queueId)}/start`),
};