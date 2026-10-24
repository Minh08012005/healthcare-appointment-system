import { apiClient } from "./client";

export const authApi = {
  register: (body) => apiClient.post("/api/auth/register", body),
  login: (body) => apiClient.post("/api/auth/login", body),
  me: () => apiClient.get("/api/auth/me"),
  logout: () => apiClient.post("/api/auth/logout"),
};