import { apiClient } from "./client";

// Contract C2-06: docs/C2-06_CREATE_APPOINTMENT_CONTRACT.md
// C2-08A (backend: appointmentManage.controller.js): list / detail / cancel
export const appointmentApi = {
  // body: { lich_kham_id, trieu_chung? }
  create: (body) => apiClient.post("/api/appointments", body),
  // GET /api/appointments -> { success, data: [lịch hẹn...] } (mới nhất trước)
  listPath: () => "/api/appointments",
  // GET /api/appointments/:id -> { success, data: lịch hẹn }
  detailPath: (id) => `/api/appointments/${id}`,
  // PATCH /api/appointments/:id/cancel -> { success, data: { id, ma_dat_lich, trang_thai } }
  cancel: (id) => apiClient.patch(`/api/appointments/${id}/cancel`),
};
