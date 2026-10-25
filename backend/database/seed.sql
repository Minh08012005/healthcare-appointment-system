-- =============================================================================
-- HEALTHCARE APPOINTMENT SYSTEM - MINIMAL SEED DATA (BASELINE V1)
-- Master data cơ bản phục vụ khởi tạo hệ thống (Idempotent seed)
-- =============================================================================

-- Khóa transaction để tránh 2 người chạy seed cùng lúc làm nhân đôi dữ liệu demo.
-- Khóa tự nhả khi transaction COMMIT/ROLLBACK (xem scripts/run-seed.js).
SELECT pg_advisory_xact_lock(20260301);


-- -----------------------------------------------------------------------------
-- 1. Master Data: VaiTro (Các vai trò cơ bản của hệ thống)
-- -----------------------------------------------------------------------------
INSERT INTO "VaiTro" ("ten_vai_tro")
VALUES
    ('Bệnh nhân'),
    ('Bác sĩ'),
    ('Lễ tân'),
    ('Xét nghiệm'),
    ('Quản trị viên')
ON CONFLICT ("ten_vai_tro") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Master Data: ChuyenKhoa (Các chuyên khoa khám bệnh mẫu)
-- -----------------------------------------------------------------------------
INSERT INTO "ChuyenKhoa" ("ten_chuyen_khoa", "mo_ta")
VALUES
    ('Nội tổng quát', 'Khám, chẩn đoán và điều trị các bệnh lý nội khoa thông thường và tổng quát.'),
    ('Tim mạch', 'Chẩn đoán và điều trị các bệnh lý tim mạch, huyết áp và hệ tuần hoàn.'),
    ('Nhi', 'Khám và chăm sóc sức khỏe toàn diện cho trẻ sơ sinh và trẻ nhỏ.'),
    ('Tai Mũi Họng', 'Khám, tầm soát và điều trị các bệnh lý vùng tai, mũi và họng.')
ON CONFLICT ("ten_chuyen_khoa") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Demo Data: PhongKham (Mỗi bác sĩ demo có 1 phòng khám riêng)
-- Idempotent: chỉ thêm phòng chưa tồn tại (ten_phong)
-- -----------------------------------------------------------------------------
INSERT INTO "PhongKham" ("ten_phong", "chuyen_khoa_id", "loai_phong")
SELECT v.ten_phong, ck.id, v.loai_phong
FROM (
    VALUES
        ('Phòng 101 - Nội tổng quát', 'Nội tổng quát', 'Phòng khám'),
        ('Phòng 102 - Nội tổng quát', 'Nội tổng quát', 'Phòng khám'),
        ('Phòng 201 - Tim mạch', 'Tim mạch', 'Phòng khám'),
        ('Phòng 202 - Tim mạch', 'Tim mạch', 'Phòng khám'),
        ('Phòng 301 - Nhi', 'Nhi', 'Phòng khám'),
        ('Phòng 401 - Tai Mũi Họng', 'Tai Mũi Họng', 'Phòng khám')
) AS v(ten_phong, ten_chuyen_khoa, loai_phong)
JOIN "ChuyenKhoa" ck ON ck.ten_chuyen_khoa = v.ten_chuyen_khoa
WHERE NOT EXISTS (
    SELECT 1 FROM "PhongKham" p WHERE p.ten_phong = v.ten_phong
);

-- -----------------------------------------------------------------------------
-- 4. Demo Data: BacSi (6 bác sĩ, đủ 4 chuyên khoa để test UC006)
-- Idempotent: chỉ thêm bác sĩ chưa tồn tại (ho_ten + chuyen_khoa_id)
-- Lưu ý: "tai_khoan_id" để NULL vì task C2-03 không tạo tài khoản bác sĩ.
-- -----------------------------------------------------------------------------
INSERT INTO "BacSi" ("ho_ten", "chuyen_khoa_id", "muc_phi", "cap_bac")
SELECT v.ho_ten, ck.id, v.muc_phi, v.cap_bac
FROM (
    VALUES
        ('Nguyễn Văn An', 'Nội tổng quát', 300000::numeric, 'Bác sĩ chuyên khoa I'),
        ('Trần Thị Bình', 'Nội tổng quát', 350000::numeric, 'Thạc sĩ, Bác sĩ'),
        ('Lê Hoàng Cường', 'Tim mạch', 500000::numeric, 'Phó Giáo sư, Tiến sĩ'),
        ('Phạm Minh Dũng', 'Tim mạch', 400000::numeric, 'Bác sĩ chuyên khoa II'),
        ('Võ Thị Hạnh', 'Nhi', 300000::numeric, 'Bác sĩ chuyên khoa I'),
        ('Đặng Quốc Khánh', 'Tai Mũi Họng', 350000::numeric, 'Thạc sĩ, Bác sĩ')
) AS v(ho_ten, ten_chuyen_khoa, muc_phi, cap_bac)
JOIN "ChuyenKhoa" ck ON ck.ten_chuyen_khoa = v.ten_chuyen_khoa
WHERE NOT EXISTS (
    SELECT 1 FROM "BacSi" b
    WHERE b.ho_ten = v.ho_ten AND b.chuyen_khoa_id = ck.id
);

-- -----------------------------------------------------------------------------
-- 5. Demo Data: LichKhamBacSi (6 bác sĩ x 5 ngày x 8 khung giờ = 240 record)
-- - Mỗi record = 1 bác sĩ + 1 ngày + 1 phòng + 1 KHUNG GIỜ cụ thể (dài 1 giờ).
-- - UC-030: ca sáng 06:00-11:00, ca chiều 13:00-16:00, slot cách nhau 1 giờ:
--     sáng : 06:00-07:00, 07:00-08:00, 08:00-09:00, 09:00-10:00, 10:00-11:00
--     chiều: 13:00-14:00, 14:00-15:00, 15:00-16:00
--   KHÔNG tạo record cho cả ca (06:00-11:00 hay 13:00-16:00).
-- - UC-031: trên mỗi record, "so_slot_toi_da" là sức chứa của khung giờ đó,
--   "so_slot_online" là phần sức chứa dành cho bệnh nhân online,
--   "so_slot_da_dat" là số lượt online đã đặt trong chính khung giờ đó.
--   Cấu hình demo cho mỗi khung: tối đa 6, online 4, đã đặt 0 (đây là demo config,
--   không phải business rule cố định - Admin có thể đổi theo UC-031).
-- - Ngày tương đối: ngày mai -> +5 ngày, tính theo giờ Việt Nam để không lệch ngày
--   (DB Neon chạy timezone GMT).
-- - so_slot_da_dat = 0 vì C2-03 KHÔNG tạo DatLichKham.
-- Idempotent: ON CONFLICT theo unique index (bac_si_id, ngay, gio_bat_dau).
-- Yêu cầu: phải chạy `npm run db:schema` trước để có unique index này.
-- -----------------------------------------------------------------------------
WITH phan_cong (ho_ten_bac_si, ten_phong) AS (
    VALUES
        ('Nguyễn Văn An', 'Phòng 101 - Nội tổng quát'),
        ('Trần Thị Bình', 'Phòng 102 - Nội tổng quát'),
        ('Lê Hoàng Cường', 'Phòng 201 - Tim mạch'),
        ('Phạm Minh Dũng', 'Phòng 202 - Tim mạch'),
        ('Võ Thị Hạnh', 'Phòng 301 - Nhi'),
        ('Đặng Quốc Khánh', 'Phòng 401 - Tai Mũi Họng')
),
khung_gio (gio_bat_dau, gio_ket_thuc) AS (
    VALUES
        ('06:00'::time, '07:00'::time),
        ('07:00'::time, '08:00'::time),
        ('08:00'::time, '09:00'::time),
        ('09:00'::time, '10:00'::time),
        ('10:00'::time, '11:00'::time),
        ('13:00'::time, '14:00'::time),
        ('14:00'::time, '15:00'::time),
        ('15:00'::time, '16:00'::time)
),
hom_nay (ngay) AS (
    SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
)
INSERT INTO "LichKhamBacSi" (
    "bac_si_id", "phong_kham_id", "ngay",
    "gio_bat_dau", "gio_ket_thuc",
    "so_slot_toi_da", "so_slot_online", "so_slot_da_dat", "trang_thai"
)
SELECT
    b.id,
    p.id,
    h.ngay + d.ngay_offset,
    c.gio_bat_dau,
    c.gio_ket_thuc,
    6, -- so_slot_toi_da: sức chứa của khung giờ (demo config)
    4, -- so_slot_online: phần sức chứa dành cho online (demo config)
    0, -- so_slot_da_dat: chưa có lượt đặt online nào
    'HoatDong'
FROM phan_cong pc
JOIN "BacSi" b ON b.ho_ten = pc.ho_ten_bac_si
JOIN "PhongKham" p ON p.ten_phong = pc.ten_phong
CROSS JOIN khung_gio c
CROSS JOIN generate_series(1, 5) AS d(ngay_offset)
CROSS JOIN hom_nay h
ON CONFLICT ("bac_si_id", "ngay", "gio_bat_dau") DO NOTHING;

