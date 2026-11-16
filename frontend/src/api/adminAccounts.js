import { apiClient } from "./client";

export const adminAccountPaths = {
  list: ({ vaiTro, trangThai, q, limit } = {}) => {
    const params = new URLSearchParams();
    if (vaiTro) params.append("vai_tro", vaiTro);
    if (trangThai) params.append("trang_thai", trangThai);
    if (q && q.trim()) params.append("q", q.trim());
    if (limit) params.append("limit", limit);
    const qs = params.toString();
    return qs ? `/api/admin/accounts?${qs}` : "/api/admin/accounts";
  },
  detail: (id) => `/api/admin/accounts/${encodeURIComponent(id)}`,
  status: (id) => `/api/admin/accounts/${encodeURIComponent(id)}/status`,
};

export const adminAccountApi = {
  list: (params) => apiClient.get(adminAccountPaths.list(params)),
  get: (id) => apiClient.get(adminAccountPaths.detail(id)),
  create: (body) => apiClient.post("/api/admin/accounts", body),
  update: (id, body) => apiClient.put(adminAccountPaths.detail(id), body),
  setStatus: (id, trangThai) =>
    apiClient.patch(adminAccountPaths.status(id), { trang_thai: trangThai }),
};
