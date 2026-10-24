// API client dùng chung: mọi Page/Component gọi Backend qua file này.
import { getToken } from "../auth/tokenStorage";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function request(path, { method = "GET", body } = {}) {
  let response;

  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Không kết nối được tới Backend. Kiểm tra Backend đã chạy chưa.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message || `Backend trả về lỗi ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};