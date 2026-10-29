-- =============================================================================
-- HEALTHCARE APPOINTMENT SYSTEM - DATABASE SCHEMA (BASELINE V1)
-- Hệ thống đặt lịch khám bệnh và quản lý phòng khám
-- =============================================================================

-- -----------------------------------------------------------------------------
-- NHÓM 1: CÁC BẢNG DANH MỤC VÀ HỆ THỐNG ĐỘC LẬP
-- -----------------------------------------------------------------------------

-- 1. Bảng VaiTro: Phân quyền vai trò người dùng trong hệ thống
CREATE TABLE IF NOT EXISTS "VaiTro" (
    "id" SERIAL PRIMARY KEY,
    "ten_vai_tro" VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Bảng ChuyenKhoa: Các chuyên khoa khám bệnh (Tim mạch, Nhi, Tai Mũi Họng...)
CREATE TABLE IF NOT EXISTS "ChuyenKhoa" (
    "id" SERIAL PRIMARY KEY,
    "ten_chuyen_khoa" VARCHAR(100) NOT NULL UNIQUE,
    "mo_ta" TEXT
);

-- 3. Bảng TinTuc: Tin tức y tế, thông báo hoạt động của phòng khám/bệnh viện
CREATE TABLE IF NOT EXISTS "TinTuc" (
    "id" SERIAL PRIMARY KEY,
    "tieu_de" VARCHAR(255) NOT NULL,
    "noi_dung" TEXT NOT NULL,
    "ngay_dang" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "trang_thai" VARCHAR(50)
);

-- 4. Bảng QuyTrinhKham: Hướng dẫn các bước trong quy trình khám bệnh
CREATE TABLE IF NOT EXISTS "QuyTrinhKham" (
    "id" SERIAL PRIMARY KEY,
    "tieu_de_buoc" VARCHAR(255) NOT NULL,
    "mo_ta" TEXT,
    "thu_tu" INTEGER NOT NULL
);

-- -----------------------------------------------------------------------------
-- NHÓM 2: TÀI KHOẢN VÀ ĐỐI TƯỢNG NGƯỜI DÙNG
-- -----------------------------------------------------------------------------

-- 5. Bảng TaiKhoan: Thông tin đăng nhập và xác thực hệ thống
CREATE TABLE IF NOT EXISTS "TaiKhoan" (
    "id" SERIAL PRIMARY KEY,
    "ten_dang_nhap" VARCHAR(50) NOT NULL UNIQUE,
    "mat_khau" VARCHAR(255) NOT NULL,
    "email" VARCHAR(100) UNIQUE,
    "so_dien_thoai" VARCHAR(20) UNIQUE,
    "vai_tro_id" INTEGER NOT NULL REFERENCES "VaiTro"("id"),
    "trang_thai" VARCHAR(50)
);

-- 6. Bảng BenhNhan: Hồ sơ thông tin cá nhân của bệnh nhân
CREATE TABLE IF NOT EXISTS "BenhNhan" (
    "id" SERIAL PRIMARY KEY,
    "tai_khoan_id" INTEGER UNIQUE REFERENCES "TaiKhoan"("id"),
    "ho_ten" VARCHAR(100) NOT NULL,
    "ngay_sinh" DATE,
    "gioi_tinh" VARCHAR(20),
    "so_cccd_ho_chieu" VARCHAR(20) UNIQUE,
    "ma_bhyt" VARCHAR(30) UNIQUE,
    "dia_chi" TEXT
);

-- 7. Bảng BacSi: Thông tin bác sĩ điều trị và chuyên môn
CREATE TABLE IF NOT EXISTS "BacSi" (
    "id" SERIAL PRIMARY KEY,
    "tai_khoan_id" INTEGER UNIQUE REFERENCES "TaiKhoan"("id"),
    "ho_ten" VARCHAR(100) NOT NULL,
    "chuyen_khoa_id" INTEGER REFERENCES "ChuyenKhoa"("id"),
    "muc_phi" NUMERIC(12, 2),
    "cap_bac" VARCHAR(100)
);

-- -----------------------------------------------------------------------------
-- NHÓM 3: CƠ SỞ VẬT CHẤT VÀ LỊCH LÀM VIỆC
-- -----------------------------------------------------------------------------

-- 8. Bảng PhongKham: Danh sách các phòng khám, phòng chức năng
CREATE TABLE IF NOT EXISTS "PhongKham" (
    "id" SERIAL PRIMARY KEY,
    "ten_phong" VARCHAR(100) NOT NULL,
    "chuyen_khoa_id" INTEGER REFERENCES "ChuyenKhoa"("id"),
    "loai_phong" VARCHAR(50)
);

-- 9. Bảng LichKhamBacSi: Lịch trực, ca khám bệnh của từng bác sĩ
CREATE TABLE IF NOT EXISTS "LichKhamBacSi" (
    "id" SERIAL PRIMARY KEY,
    "bac_si_id" INTEGER NOT NULL REFERENCES "BacSi"("id"),
    "phong_kham_id" INTEGER REFERENCES "PhongKham"("id"),
    "ngay" DATE NOT NULL,
    "gio_bat_dau" TIME NOT NULL,
    "gio_ket_thuc" TIME NOT NULL,
    "so_slot_toi_da" INTEGER NOT NULL,
    "so_slot_online" INTEGER DEFAULT 0,
    "so_slot_da_dat" INTEGER DEFAULT 0,
    "trang_thai" VARCHAR(50)
);

-- -----------------------------------------------------------------------------
-- NHÓM 4: ĐẶT LỊCH, TIẾP ĐÓN VÀ XẾP HÀNG ĐỢI
-- -----------------------------------------------------------------------------

-- 10. Bảng DatLichKham: Phiếu đăng ký đặt hẹn khám bệnh
CREATE TABLE IF NOT EXISTS "DatLichKham" (
    "id" SERIAL PRIMARY KEY,
    "ma_dat_lich" VARCHAR(50) NOT NULL UNIQUE,
    "benh_nhan_id" INTEGER NOT NULL REFERENCES "BenhNhan"("id"),
    "bac_si_id" INTEGER REFERENCES "BacSi"("id"),
    "phong_kham_id" INTEGER REFERENCES "PhongKham"("id"),
    "chuyen_khoa_id" INTEGER REFERENCES "ChuyenKhoa"("id"),
    "ngay_kham" DATE NOT NULL,
    "gio_kham" TIME,
    "trieu_chung" TEXT,
    "phi_kham" NUMERIC(12, 2),
    "trang_thai" VARCHAR(50),
    "qr_code" TEXT
);

-- 11. Bảng HangDoi: Hàng đợi thực tế tại phòng khám sau khi check-in hoặc bốc số
-- C3 contract: loai ONLINE | OFFLINE; trang_thai CHO_KHAM | DANG_GOI |
-- DANG_KHAM | BO_LUOT | VANG_MAT | DA_XONG.
CREATE TABLE IF NOT EXISTS "HangDoi" (
    "id" SERIAL PRIMARY KEY,
    "dat_lich_id" INTEGER REFERENCES "DatLichKham"("id"),
    "benh_nhan_id" INTEGER NOT NULL REFERENCES "BenhNhan"("id"),
    "so_thu_tu" INTEGER NOT NULL,
    "phong_kham_id" INTEGER REFERENCES "PhongKham"("id"),
    "bac_si_id" INTEGER REFERENCES "BacSi"("id"),
    "loai" VARCHAR(50),
    "trang_thai" VARCHAR(50),
    "thoi_gian_check_in" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "so_lan_goi" INTEGER NOT NULL DEFAULT 0,
    "so_lan_bo_luot" INTEGER NOT NULL DEFAULT 0
);

-- C3-01: cập nhật bảng đã tồn tại mà không ảnh hưởng dữ liệu hiện có.
ALTER TABLE "HangDoi"
    ADD COLUMN IF NOT EXISTS "so_lan_goi" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "so_lan_bo_luot" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CauHinhHeThong" (
    "id" SERIAL PRIMARY KEY,
    "ti_le_online" INTEGER NOT NULL DEFAULT 1,
    "ti_le_offline" INTEGER NOT NULL DEFAULT 1,
    "checkin_som_nhat_phut" INTEGER NOT NULL DEFAULT 60,
    "checkin_toi_thieu_phut" INTEGER NOT NULL DEFAULT 10,
    "so_lan_goi_toi_da" INTEGER NOT NULL DEFAULT 3,
    "khoang_cach_goi_phut" INTEGER NOT NULL DEFAULT 1,
    "chu_ky_quet_phut" INTEGER NOT NULL DEFAULT 1
);

-- -----------------------------------------------------------------------------
-- NHÓM 5: KHÁM CHỮA BỆNH, HỒ SƠ VÀ CẬN LÂM SÀNG
-- -----------------------------------------------------------------------------

-- 12. Bảng HoSoBenhAn: Hồ sơ bệnh án của lượt khám (liên kết qua lượt xếp hàng đợi)
CREATE TABLE IF NOT EXISTS "HoSoBenhAn" (
    "id" SERIAL PRIMARY KEY,
    "hang_doi_id" INTEGER REFERENCES "HangDoi"("id"),
    "benh_nhan_id" INTEGER NOT NULL REFERENCES "BenhNhan"("id"),
    "bac_si_id" INTEGER REFERENCES "BacSi"("id"),
    "ngay_kham" DATE DEFAULT CURRENT_DATE,
    "trang_thai" VARCHAR(50)
);

-- 13. Bảng KetQuaKham: Kết luận chẩn đoán, lời dặn và đơn thuốc của bác sĩ
CREATE TABLE IF NOT EXISTS "KetQuaKham" (
    "id" SERIAL PRIMARY KEY,
    "ho_so_id" INTEGER NOT NULL REFERENCES "HoSoBenhAn"("id"),
    "trieu_chung_ghi_nhan" TEXT,
    "chan_doan" TEXT,
    "loi_dan" TEXT,
    "don_thuoc" TEXT
);

-- 14. Bảng ChiDinhXetNghiem: Các phiếu chỉ định cận lâm sàng / xét nghiệm
CREATE TABLE IF NOT EXISTS "ChiDinhXetNghiem" (
    "id" SERIAL PRIMARY KEY,
    "ho_so_id" INTEGER NOT NULL REFERENCES "HoSoBenhAn"("id"),
    "phong_kham_id" INTEGER REFERENCES "PhongKham"("id"),
    "trang_thai" VARCHAR(50)
);

-- 15. Bảng KetQuaXetNghiem: Kết quả và tệp đính kèm của xét nghiệm
CREATE TABLE IF NOT EXISTS "KetQuaXetNghiem" (
    "id" SERIAL PRIMARY KEY,
    "chi_dinh_id" INTEGER NOT NULL REFERENCES "ChiDinhXetNghiem"("id"),
    "file_ket_qua" TEXT,
    "mo_ta" TEXT
);

-- -----------------------------------------------------------------------------
-- NHÓM 6: INDEX HỖ TRỢ TRA CỨU CHUYÊN KHOA / BÁC SĨ / LỊCH KHÁM
-- -----------------------------------------------------------------------------
-- Quy ước dữ liệu lịch khám (C2-04 dùng để trả slot availability):
--   - MỖI RECORD "LichKhamBacSi" = 1 bác sĩ + 1 ngày + 1 phòng + 1 KHUNG GIỜ cụ thể.
--   - "gio_bat_dau"/"gio_ket_thuc" là giới hạn của chính khung giờ đó (dài 1 giờ).
--   - UC-030: ca sáng 06:00-11:00 và ca chiều 13:00-16:00, slot cách nhau 1 giờ:
--       06:00-07:00, 07:00-08:00, 08:00-09:00, 09:00-10:00, 10:00-11:00,
--       13:00-14:00, 14:00-15:00, 15:00-16:00.
--     KHÔNG lưu record cho cả ca (06:00-11:00 / 13:00-16:00) và KHÔNG chia một record
--     thành nhiều mốc giờ bên trong.
--   - "so_slot_toi_da": tổng sức chứa của khung giờ, Admin cấu hình theo UC-031.
--   - "so_slot_online": phần sức chứa của khung giờ dành cho bệnh nhân online.
--   - "so_slot_da_dat": số lượt online đã đặt trong chính khung giờ đó.
--   - Online còn lại = so_slot_online - so_slot_da_dat
--     (0 <= online còn lại <= so_slot_online <= so_slot_toi_da).
--   - Phần tiếp đón offline = so_slot_toi_da - so_slot_online.
--   - "trang_thai": 'HoatDong' (đang mở) | 'DaHuy' (đã hủy) | 'HetCho' (đã đầy)
--   - UC-008: khung giờ còn dưới 10 phút trước "gio_bat_dau" thì không được đặt
--     (C2-04/C2-06 kiểm tra; C2-03 chỉ ghi quy ước, không implement booking).
-- Chỉ thêm index (IF NOT EXISTS) để chạy lại an toàn, không thêm bảng/cột mới.

-- Mỗi bác sĩ chỉ có tối đa 1 ca khám bắt đầu tại cùng một thời điểm trong cùng ngày
CREATE UNIQUE INDEX IF NOT EXISTS "ux_lichkhambacsi_bacsi_ngay_gio"
    ON "LichKhamBacSi" ("bac_si_id", "ngay", "gio_bat_dau");

-- Tra cứu lịch khám theo bác sĩ trong một khoảng ngày
CREATE INDEX IF NOT EXISTS "ix_lichkhambacsi_bacsi_ngay"
    ON "LichKhamBacSi" ("bac_si_id", "ngay");

-- Lọc bác sĩ theo chuyên khoa (Master API)
CREATE INDEX IF NOT EXISTS "ix_bacsi_chuyen_khoa"
    ON "BacSi" ("chuyen_khoa_id");

