import { apiClient } from "./client";

// C6-07: API client phân công lịch trực (UC-030) và tổng quan lịch khám (UC-033)
export const adminSchedulePaths = {
  list: ({ startDate, endDate, date, chuyenKhoaId, bacSiId, phongKhamId, all } = {}) => {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (date) params.append("date", date);
    if (chuyenKhoaId) params.append("chuyen_khoa_id", chuyenKhoaId);
    if (bacSiId) params.append("bac_si_id", bacSiId);
    if (phongKhamId) params.append("phong_kham_id", phongKhamId);
    if (all) params.append("all", "true");
    const qs = params.toString();
    return qs ? `/api/admin/schedules?${qs}` : "/api/admin/schedules";
  },
  overview: (params) => adminSchedulePaths.list(params),
  detail: (id) => `/api/admin/schedules/${encodeURIComponent(id)}`,
};

export const adminScheduleApi = {
  list: (params) => apiClient.get(adminSchedulePaths.list(params)),
  create: (body) => apiClient.post("/api/admin/schedules", body),
  delete: (id) => apiClient.delete(adminSchedulePaths.detail(id)),
};
