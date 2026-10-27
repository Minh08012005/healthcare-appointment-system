import { apiClient } from "./client";

// Contract C2-06: docs/C2-06_CREATE_APPOINTMENT_CONTRACT.md
export const appointmentApi = {
  // body: { lich_kham_id, trieu_chung? }
  create: (body) => apiClient.post("/api/appointments", body),
};