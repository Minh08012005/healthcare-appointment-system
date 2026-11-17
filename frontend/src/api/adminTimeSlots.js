import { apiClient } from "./client";

// C6-06: cấu hình khung giờ & slot (template cho lịch trực mới)
export const adminTimeSlotPaths = {
  list: () => "/api/admin/time-slots",
  detail: (id) => `/api/admin/time-slots/${encodeURIComponent(id)}`,
};

export const adminTimeSlotApi = {
  // body: { so_slot_toi_da, so_slot_online } (số nguyên)
  update: (id, body) => apiClient.put(adminTimeSlotPaths.detail(id), body),
};