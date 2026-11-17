import { apiClient } from "./client";

export const adminDoctorPaths = {
  list: ({ chuyenKhoaId, q, limit } = {}) => {
    const params = new URLSearchParams();
    if (chuyenKhoaId) params.append("chuyen_khoa_id", chuyenKhoaId);
    if (q && q.trim()) params.append("q", q.trim());
    if (limit) params.append("limit", limit);
    const qs = params.toString();
    return qs ? `/api/admin/doctors?${qs}` : "/api/admin/doctors";
  },
  detail: (id) => `/api/admin/doctors/${encodeURIComponent(id)}`,
};

export const adminDoctorApi = {
  list: (params) => apiClient.get(adminDoctorPaths.list(params)),
  get: (id) => apiClient.get(adminDoctorPaths.detail(id)),
  create: (body) => apiClient.post("/api/admin/doctors", body),
  update: (id, body) => apiClient.put(adminDoctorPaths.detail(id), body),
};
