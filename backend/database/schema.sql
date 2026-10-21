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
CREATE TABLE IF NOT EXISTS "HangDoi" (
    "id" SERIAL PRIMARY KEY,
    "dat_lich_id" INTEGER REFERENCES "DatLichKham"("id"),
    "benh_nhan_id" INTEGER NOT NULL REFERENCES "BenhNhan"("id"),
    "so_thu_tu" INTEGER NOT NULL,
    "phong_kham_id" INTEGER REFERENCES "PhongKham"("id"),
    "bac_si_id" INTEGER REFERENCES "BacSi"("id"),
    "loai" VARCHAR(50),
    "trang_thai" VARCHAR(50),
    "thoi_gian_check_in" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
