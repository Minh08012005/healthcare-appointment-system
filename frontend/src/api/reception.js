import { apiClient } from "./client";

// C3-02: docs/C3-02_ONLINE_CHECKIN_CONTRACT.md
// C3-04: backend/src/controllers/receptionOffline.controller.js
export const receptionApi = {
  // body: { ma_dat_lich } hoặc { qr_code }
  checkinOnline: (body) => apiClient.post("/api/checkin/online", body),
  // body: { patient: { ho_ten, so_cccd_ho_chieu, ngay_sinh?, gioi_tinh?, ma_bhyt?, dia_chi? },
  //         trieu_chung, chuyen_khoa_id, phong_kham_id }
  // 201 -> { success, data: { queue: { stt_hien_thi, so_nguoi_cho_truoc, ... }, patient, room, specialty } }
  offlineCheckin: (body) => apiClient.post("/api/reception/offline-checkin", body),
  // -> { success, data: [{ id, ten_chuyen_khoa, mo_ta }] }
  getSpecialties: () => apiClient.get("/api/master/chuyen-khoa"),
  // -> { success, data: [{ id, ten_phong, loai_phong, chuyen_khoa_id, ten_chuyen_khoa }] }
  getRooms: (chuyenKhoaId) =>
    apiClient.get(`/api/master/phong-kham?chuyen_khoa_id=${encodeURIComponent(chuyenKhoaId)}`),
};