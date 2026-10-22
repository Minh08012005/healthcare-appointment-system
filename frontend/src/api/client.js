// API client dùng chung: mọi Page/Component gọi Backend qua file này.
// Địa chỉ Backend lấy từ file .env (VITE_API_URL).
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function request(path, { method = 'GET', body } = {}) {
  let response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Backend không chạy, mất mạng, hoặc bị chặn CORS
    throw new Error('Không kết nối được tới Backend. Kiểm tra Backend đã chạy chưa.')
  }

  // Có thể Backend trả về nội dung không phải JSON
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.message || `Backend trả về lỗi ${response.status}`)
  }

  return data
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
}