import { apiClient } from "./client";

// C6-04: Admin quản lý phòng + gán nhân viên (TaiKhoan.phong_kham_id)
export const adminRoomPaths = {
  list: () => "/api/admin/rooms",
  detail: (id) => `/api/admin/rooms/${encodeURIComponent(id)}`,
  staff: (roomId, accountId) =>
    `/api/admin/rooms/${encodeURIComponent(roomId)}/staff/${encodeURIComponent(accountId)}`,
};

export const adminRoomApi = {
  create: (body) => apiClient.post(adminRoomPaths.list(), body),
  update: (id, body) => apiClient.put(adminRoomPaths.detail(id), body),
  delete: (id) => apiClient.delete(adminRoomPaths.detail(id)),
  // 409 ACCOUNT_IN_OTHER_ROOM nếu đang ở phòng khác -> gọi lại với confirmTransfer = true
  assignStaff: (roomId, accountId, confirmTransfer = false) =>
    apiClient.put(adminRoomPaths.staff(roomId, accountId), { confirm_transfer: confirmTransfer }),
  unassignStaff: (roomId, accountId) => apiClient.delete(adminRoomPaths.staff(roomId, accountId)),
};