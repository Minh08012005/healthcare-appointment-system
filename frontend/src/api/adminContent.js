import { apiClient } from "./client";

export const adminContentPaths = {
  newsList: ({ trang_thai, q, limit } = {}) => {
    const params = new URLSearchParams();
    if (trang_thai) params.append("trang_thai", trang_thai);
    if (q && q.trim()) params.append("q", q.trim());
    if (limit) params.append("limit", limit);
    const qs = params.toString();
    return qs ? `/api/admin/content/news?${qs}` : "/api/admin/content/news";
  },
  newsDetail: (id) => `/api/admin/content/news/${encodeURIComponent(id)}`,
  newsStatus: (id) => `/api/admin/content/news/${encodeURIComponent(id)}/status`,
  stepList: () => "/api/admin/content/procedure-steps",
  stepDetail: (id) => `/api/admin/content/procedure-steps/${encodeURIComponent(id)}`,
};

export const adminContentApi = {
  // Tin tức
  listNews: (params) => apiClient.get(adminContentPaths.newsList(params)),
  getNews: (id) => apiClient.get(adminContentPaths.newsDetail(id)),
  createNews: (body) => apiClient.post("/api/admin/content/news", body),
  updateNews: (id, body) => apiClient.put(adminContentPaths.newsDetail(id), body),
  setNewsStatus: (id, trangThai) =>
    apiClient.patch(adminContentPaths.newsStatus(id), { trang_thai: trangThai }),
  deleteNews: (id) => apiClient.delete(adminContentPaths.newsDetail(id)),

  // Quy trình khám
  listSteps: () => apiClient.get(adminContentPaths.stepList()),
  createStep: (body) => apiClient.post("/api/admin/content/procedure-steps", body),
  updateStep: (id, body) => apiClient.put(adminContentPaths.stepDetail(id), body),
  deleteStep: (id) => apiClient.delete(adminContentPaths.stepDetail(id)),
};
