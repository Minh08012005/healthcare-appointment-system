import { apiClient } from "./client";

export const queueSettingsApi = {
  get: () => apiClient.get("/api/admin/queue-settings"),
  update: (body) => apiClient.put("/api/admin/queue-settings", body),
};
