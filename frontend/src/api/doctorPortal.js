import { apiClient } from "./client";

export const doctorPortalApi = {
  getPatients: (status = "CHO_KHAM") =>
    apiClient.get(`/api/doctor/patients?status=${encodeURIComponent(status)}`),
  getSchedules: (startDate) =>
    apiClient.get(
      startDate
        ? `/api/doctor/schedules?start_date=${encodeURIComponent(startDate)}`
        : "/api/doctor/schedules",
    ),
};
