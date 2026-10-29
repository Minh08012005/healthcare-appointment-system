import { apiClient } from "./client";

// C3-02: docs/C3-02_ONLINE_CHECKIN_CONTRACT.md
// C3-04: backend/src/controllers/receptionOffline.controller.js
export const receptionApi = {
  // body: { ma_dat_lich } hoặc { qr_code }
  checkinOnline: (body) => apiClient.post("/api/checkin/online", body),
  // body: { patient: {...}, trieu_chung, chuyen_khoa_id, phong_kham_id }
  offlineCheckin: (body) => apiClient.post("/api/reception/offline-checkin", body),
  // GET -> { success, data: [{ id, ten_chuyen_khoa, mo_ta }] }
  specialtiesPath: () => "/api/master/chuyen-khoa",
  // GET -> { success, data: [{ id, ten_phong, chuyen_khoa_id }] } (API master phòng khám, chờ BE)
  roomsPath: (chuyenKhoaId) => `/api/master/phong-kham?chuyen_khoa_id=${chuyenKhoaId}`,
};