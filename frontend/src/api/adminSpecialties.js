import { apiClient } from "./client";

export const adminSpecialtyPaths = {
  list: () => "/api/admin/specialties",
  detail: (id) => `/api/admin/specialties/${encodeURIComponent(id)}`,
};

export const adminSpecialtyApi = {
  list: () => apiClient.get(adminSpecialtyPaths.list()),
  get: (id) => apiClient.get(adminSpecialtyPaths.detail(id)),
  create: (body) => apiClient.post(adminSpecialtyPaths.list(), body),
  update: (id, body) => apiClient.put(adminSpecialtyPaths.detail(id), body),
  delete: (id) => apiClient.delete(adminSpecialtyPaths.detail(id)),
};
