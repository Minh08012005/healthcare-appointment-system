-- =============================================================================
-- HEALTHCARE APPOINTMENT SYSTEM - FINAL MANUAL-TEST SEED DATA (BASELINE V1)
-- Master data & Demo data chuẩn phục vụ kiểm thử thủ công hệ thống (Idempotent seed)
-- =============================================================================

-- Khóa transaction để tránh 2 tiến trình chạy seed đồng thời.
-- Khóa tự động giải phóng khi transaction COMMIT/ROLLBACK.
SELECT pg_advisory_xact_lock(20260301);

-- -----------------------------------------------------------------------------
-- 1. Cấu hình hệ thống (CauHinhHeThong - Baseline C3-01)
-- -----------------------------------------------------------------------------
INSERT INTO "CauHinhHeThong"
    ("ti_le_online", "ti_le_offline", "checkin_som_nhat_phut",
     "checkin_toi_thieu_phut", "so_lan_goi_toi_da",
     "khoang_cach_goi_phut", "chu_ky_quet_phut")
SELECT 1, 1, 60, 10, 3, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM "CauHinhHeThong");

-- -----------------------------------------------------------------------------
-- 2. Cấu hình khung giờ & Sức chứa (CauHinhKhungGio - Baseline C6-06)
-- 8 khung giờ chuẩn 1 tiếng theo UC-030 (sáng 06:00-11:00, chiều 13:00-16:00)
-- Sức chứa mặc định: tối đa 6, online 4 (offline = 2) theo UC-031
-- -----------------------------------------------------------------------------
INSERT INTO "CauHinhKhungGio" ("ca", "gio_bat_dau", "gio_ket_thuc", "so_slot_toi_da", "so_slot_online") VALUES
    ('SANG',  '06:00', '07:00', 6, 4),
    ('SANG',  '07:00', '08:00', 6, 4),
    ('SANG',  '08:00', '09:00', 6, 4),
    ('SANG',  '09:00', '10:00', 6, 4),
    ('SANG',  '10:00', '11:00', 6, 4),
    ('CHIEU', '13:00', '14:00', 6, 4),
    ('CHIEU', '14:00', '15:00', 6, 4),
    ('CHIEU', '15:00', '16:00', 6, 4)
ON CONFLICT ("gio_bat_dau") DO UPDATE
SET "ca" = EXCLUDED."ca",
    "gio_ket_thuc" = EXCLUDED."gio_ket_thuc",
    "so_slot_toi_da" = EXCLUDED."so_slot_toi_da",
    "so_slot_online" = EXCLUDED."so_slot_online";

-- -----------------------------------------------------------------------------
-- 3. Master Data: VaiTro (5 vai trò chuẩn)
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
-- 4. Master Data: ChuyenKhoa (4 chuyên khoa chuẩn)
-- -----------------------------------------------------------------------------
INSERT INTO "ChuyenKhoa" ("ten_chuyen_khoa", "mo_ta")
VALUES
    ('Nội tổng quát', 'Khám, chẩn đoán và điều trị các bệnh lý nội khoa thông thường và tổng quát.'),
    ('Tim mạch', 'Chẩn đoán và điều trị các bệnh lý tim mạch, huyết áp và hệ tuần hoàn.'),
    ('Nhi', 'Khám và chăm sóc sức khỏe toàn diện cho trẻ sơ sinh và trẻ nhỏ.'),
    ('Tai Mũi Họng', 'Khám, tầm soát và điều trị các bệnh lý vùng tai, mũi và họng.')
ON CONFLICT ("ten_chuyen_khoa") DO UPDATE
SET "mo_ta" = EXCLUDED."mo_ta";

-- -----------------------------------------------------------------------------
-- 5. Cơ sở vật chất: PhongKham (6 phòng khám chuyên khoa + 3 phòng xét nghiệm)
-- -----------------------------------------------------------------------------
-- 5.1. Phòng khám chuyên khoa (chuyen_khoa_id tương ứng)
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

-- 5.2. Phòng cận lâm sàng / xét nghiệm (C5-01: chuyen_khoa_id = NULL)
INSERT INTO "PhongKham" ("ten_phong", "chuyen_khoa_id", "loai_phong")
SELECT v.ten_phong, NULL, v.loai_phong
FROM (
    VALUES
        ('Phòng Xét nghiệm Huyết học', 'Phòng xét nghiệm'),
        ('Phòng Xét nghiệm Sinh hóa', 'Phòng xét nghiệm'),
        ('Phòng Chẩn đoán hình ảnh', 'Phòng xét nghiệm')
) AS v(ten_phong, loai_phong)
WHERE NOT EXISTS (
    SELECT 1 FROM "PhongKham" p WHERE p.ten_phong = v.ten_phong
);

-- -----------------------------------------------------------------------------
-- 6. Danh mục Bác sĩ: BacSi (6 bác sĩ chuẩn)
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
-- 7. Tài khoản người dùng (TaiKhoan) - Mật khẩu chung: 123456
-- Hash bcrypt 10 rounds: $2b$10$/lxg4zcY2HZcPcrIHUJic.1VQFg/cdHYcDy7JhbBgiGGT9kLiamAi
-- -----------------------------------------------------------------------------

-- 7.1. Quản trị viên (Admin)
INSERT INTO "TaiKhoan" ("ten_dang_nhap", "mat_khau", "email", "so_dien_thoai", "vai_tro_id", "trang_thai")
SELECT 'admin', '$2b$10$/lxg4zcY2HZcPcrIHUJic.1VQFg/cdHYcDy7JhbBgiGGT9kLiamAi', 'admin@medicare.vn', '0901000001', vt.id, 'HoatDong'
FROM "VaiTro" vt WHERE vt.ten_vai_tro = 'Quản trị viên'
ON CONFLICT ("ten_dang_nhap") DO UPDATE
SET "mat_khau" = EXCLUDED."mat_khau", "trang_thai" = 'HoatDong';

-- 7.2. Lễ tân (Receptionist - Gán phòng đón tiếp)
INSERT INTO "TaiKhoan" ("ten_dang_nhap", "mat_khau", "email", "so_dien_thoai", "vai_tro_id", "trang_thai", "phong_kham_id")
SELECT v.ten_dang_nhap, '$2b$10$/lxg4zcY2HZcPcrIHUJic.1VQFg/cdHYcDy7JhbBgiGGT9kLiamAi', v.email, v.so_dien_thoai, vt.id, 'HoatDong', pk.id
FROM (
    VALUES
        ('letan_01', 'letan01@medicare.vn', '0902000001', 'Phòng 101 - Nội tổng quát'),
        ('letan_02', 'letan02@medicare.vn', '0902000002', 'Phòng 201 - Tim mạch')
) AS v(ten_dang_nhap, email, so_dien_thoai, ten_phong)
JOIN "VaiTro" vt ON vt.ten_vai_tro = 'Lễ tân'
JOIN "PhongKham" pk ON pk.ten_phong = v.ten_phong
ON CONFLICT ("ten_dang_nhap") DO UPDATE
SET "mat_khau" = EXCLUDED."mat_khau",
    "trang_thai" = 'HoatDong',
    "phong_kham_id" = EXCLUDED."phong_kham_id";

-- 7.3. Nhân viên Xét nghiệm (Lab staff - Gán phòng xét nghiệm)
INSERT INTO "TaiKhoan" ("ten_dang_nhap", "mat_khau", "email", "so_dien_thoai", "vai_tro_id", "trang_thai", "phong_kham_id")
SELECT v.ten_dang_nhap, '$2b$10$/lxg4zcY2HZcPcrIHUJic.1VQFg/cdHYcDy7JhbBgiGGT9kLiamAi', v.email, v.so_dien_thoai, vt.id, 'HoatDong', pk.id
FROM (
    VALUES
        ('ktv_huyethoc', 'ktv_huyethoc@medicare.vn', '0905000001', 'Phòng Xét nghiệm Huyết học'),
        ('ktv_sinhhoa', 'ktv_sinhhoa@medicare.vn', '0905000002', 'Phòng Xét nghiệm Sinh hóa'),
        ('ktv_cdha', 'ktv_cdha@medicare.vn', '0905000003', 'Phòng Chẩn đoán hình ảnh')
) AS v(ten_dang_nhap, email, so_dien_thoai, ten_phong)
JOIN "VaiTro" vt ON vt.ten_vai_tro = 'Xét nghiệm'
JOIN "PhongKham" pk ON pk.ten_phong = v.ten_phong
ON CONFLICT ("ten_dang_nhap") DO UPDATE
SET "mat_khau" = EXCLUDED."mat_khau",
    "trang_thai" = 'HoatDong',
    "phong_kham_id" = EXCLUDED."phong_kham_id";

-- 7.4. Bác sĩ (Doctor accounts cho 6 bác sĩ chuẩn)
INSERT INTO "TaiKhoan" ("ten_dang_nhap", "mat_khau", "email", "so_dien_thoai", "vai_tro_id", "trang_thai")
SELECT v.ten_dang_nhap, '$2b$10$/lxg4zcY2HZcPcrIHUJic.1VQFg/cdHYcDy7JhbBgiGGT9kLiamAi', v.email, v.so_dien_thoai, vt.id, 'HoatDong'
FROM (
    VALUES
        ('bs_an', 'bs.an@medicare.vn', '0903000001'),
        ('bs_binh', 'bs.binh@medicare.vn', '0903000002'),
        ('bs_cuong', 'bs.cuong@medicare.vn', '0903000003'),
        ('bs_dung', 'bs.dung@medicare.vn', '0903000004'),
        ('bs_hanh', 'bs.hanh@medicare.vn', '0903000005'),
        ('bs_khanh', 'bs.khanh@medicare.vn', '0903000006')
) AS v(ten_dang_nhap, email, so_dien_thoai)
JOIN "VaiTro" vt ON vt.ten_vai_tro = 'Bác sĩ'
ON CONFLICT ("ten_dang_nhap") DO UPDATE
SET "mat_khau" = EXCLUDED."mat_khau", "trang_thai" = 'HoatDong';

-- Cập nhật liên kết BacSi.tai_khoan_id
UPDATE "BacSi" b
SET "tai_khoan_id" = tk.id
FROM "TaiKhoan" tk
WHERE tk.ten_dang_nhap = 'bs_an' AND b.ho_ten = 'Nguyễn Văn An';

UPDATE "BacSi" b
SET "tai_khoan_id" = tk.id
FROM "TaiKhoan" tk
WHERE tk.ten_dang_nhap = 'bs_binh' AND b.ho_ten = 'Trần Thị Bình';

UPDATE "BacSi" b
SET "tai_khoan_id" = tk.id
FROM "TaiKhoan" tk
WHERE tk.ten_dang_nhap = 'bs_cuong' AND b.ho_ten = 'Lê Hoàng Cường';

UPDATE "BacSi" b
SET "tai_khoan_id" = tk.id
FROM "TaiKhoan" tk
WHERE tk.ten_dang_nhap = 'bs_dung' AND b.ho_ten = 'Phạm Minh Dũng';

UPDATE "BacSi" b
SET "tai_khoan_id" = tk.id
FROM "TaiKhoan" tk
WHERE tk.ten_dang_nhap = 'bs_hanh' AND b.ho_ten = 'Võ Thị Hạnh';

UPDATE "BacSi" b
SET "tai_khoan_id" = tk.id
FROM "TaiKhoan" tk
WHERE tk.ten_dang_nhap = 'bs_khanh' AND b.ho_ten = 'Đặng Quốc Khánh';

-- 7.5. Bệnh nhân mẫu (Patient accounts + Profiles đầy đủ)
INSERT INTO "TaiKhoan" ("ten_dang_nhap", "mat_khau", "email", "so_dien_thoai", "vai_tro_id", "trang_thai")
SELECT v.ten_dang_nhap, '$2b$10$/lxg4zcY2HZcPcrIHUJic.1VQFg/cdHYcDy7JhbBgiGGT9kLiamAi', v.email, v.so_dien_thoai, vt.id, 'HoatDong'
FROM (
    VALUES
        ('benhnhan_01', 'benhnhan01@medicare.vn', '0904000001'),
        ('benhnhan_02', 'benhnhan02@medicare.vn', '0904000002')
) AS v(ten_dang_nhap, email, so_dien_thoai)
JOIN "VaiTro" vt ON vt.ten_vai_tro = 'Bệnh nhân'
ON CONFLICT ("ten_dang_nhap") DO UPDATE
SET "mat_khau" = EXCLUDED."mat_khau", "trang_thai" = 'HoatDong';

-- Profile bệnh nhân 1
INSERT INTO "BenhNhan" ("tai_khoan_id", "ho_ten", "ngay_sinh", "gioi_tinh", "so_cccd_ho_chieu", "ma_bhyt", "dia_chi")
SELECT tk.id, 'Nguyễn Văn Bình', '1990-05-15'::date, 'Nam', '001090012345', 'DN4010123456789', '123 Cầu Giấy, Hà Nội'
FROM "TaiKhoan" tk
WHERE tk.ten_dang_nhap = 'benhnhan_01'
ON CONFLICT ("tai_khoan_id") DO UPDATE
SET "ho_ten" = EXCLUDED."ho_ten",
    "ngay_sinh" = EXCLUDED."ngay_sinh",
    "gioi_tinh" = EXCLUDED."gioi_tinh",
    "so_cccd_ho_chieu" = EXCLUDED."so_cccd_ho_chieu",
    "ma_bhyt" = EXCLUDED."ma_bhyt",
    "dia_chi" = EXCLUDED."dia_chi";

-- Profile bệnh nhân 2
INSERT INTO "BenhNhan" ("tai_khoan_id", "ho_ten", "ngay_sinh", "gioi_tinh", "so_cccd_ho_chieu", "ma_bhyt", "dia_chi")
SELECT tk.id, 'Trần Thị Mai', '1995-10-20'::date, 'Nữ', '001195098765', 'GD4010987654321', '456 Đống Đa, Hà Nội'
FROM "TaiKhoan" tk
WHERE tk.ten_dang_nhap = 'benhnhan_02'
ON CONFLICT ("tai_khoan_id") DO UPDATE
SET "ho_ten" = EXCLUDED."ho_ten",
    "ngay_sinh" = EXCLUDED."ngay_sinh",
    "gioi_tinh" = EXCLUDED."gioi_tinh",
    "so_cccd_ho_chieu" = EXCLUDED."so_cccd_ho_chieu",
    "ma_bhyt" = EXCLUDED."ma_bhyt",
    "dia_chi" = EXCLUDED."dia_chi";

-- -----------------------------------------------------------------------------
-- 8. Lịch khám bác sĩ: LichKhamBacSi
-- 6 bác sĩ x 7 ngày liên tiếp (Hôm nay -> +6 ngày) x 8 khung giờ chuẩn = 336 slots
-- Phân công đúng phòng, đúng chuyên khoa, sức chứa chuẩn (tối đa 6, online 4)
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
    6, -- so_slot_toi_da
    4, -- so_slot_online
    0, -- so_slot_da_dat
    'HoatDong'
FROM phan_cong pc
JOIN "BacSi" b ON b.ho_ten = pc.ho_ten_bac_si
JOIN "PhongKham" p ON p.ten_phong = pc.ten_phong
CROSS JOIN khung_gio c
CROSS JOIN generate_series(0, 6) AS d(ngay_offset)
CROSS JOIN hom_nay h
ON CONFLICT ("bac_si_id", "ngay", "gio_bat_dau") DO UPDATE
SET "so_slot_toi_da" = EXCLUDED."so_slot_toi_da",
    "so_slot_online" = EXCLUDED."so_slot_online",
    "phong_kham_id" = EXCLUDED."phong_kham_id",
    "trang_thai" = 'HoatDong';

-- -----------------------------------------------------------------------------
-- 9. Quy trình khám bệnh: QuyTrinhKham (5 bước chuẩn theo UC-036)
-- -----------------------------------------------------------------------------
INSERT INTO "QuyTrinhKham" ("tieu_de_buoc", "mo_ta", "thu_tu")
SELECT v.tieu_de_buoc, v.mo_ta, v.thu_tu
FROM (
    VALUES
        ('Đặt lịch khám', 'Đăng ký tài khoản và chọn chuyên khoa, bác sĩ, khung giờ khám bệnh trực tuyến.', 1),
        ('Check-in và tiếp nhận bệnh nhân', 'Xác nhận mã đặt lịch tại cổng tiếp đón hoặc quét mã QR trên phiếu hẹn.', 2),
        ('Chờ và vào khám', 'Theo dõi số thứ tự gọi tên trên bảng điện tử và di chuyển vào phòng khám khi tới lượt.', 3),
        ('Khám và xét nghiệm', 'Bác sĩ thăm khám lâm sàng, chỉ định cận lâm sàng / xét nghiệm nếu cần thiết.', 4),
        ('Hoàn tất khám', 'Nhận đơn thuốc, hướng dẫn điều trị, thanh toán viện phí và lịch hẹn tái khám (nếu có).', 5)
) AS v(tieu_de_buoc, mo_ta, thu_tu)
WHERE NOT EXISTS (
    SELECT 1 FROM "QuyTrinhKham" q WHERE q.thu_tu = v.thu_tu
);

-- -----------------------------------------------------------------------------
-- 10. Tin tức y tế: TinTuc (3 bài tin tức chuẩn cho trang công khai /news - UC-035)
-- -----------------------------------------------------------------------------
INSERT INTO "TinTuc" ("tieu_de", "noi_dung", "ngay_dang", "trang_thai")
SELECT v.tieu_de, v.noi_dung, v.ngay_dang, 'HienThi'
FROM (
    VALUES
        (
            'Lịch làm việc và hướng dẫn đăng ký khám bệnh tại MEDICARE',
            'Phòng khám MEDICARE xin thông báo lịch khám bệnh từ Thứ Hai đến Chủ Nhật. Khách hàng vui lòng đặt lịch trực tuyến trước ít nhất 10 phút để nhận số thứ tự ưu tiên và tiết kiệm thời gian chờ đợi.',
            CURRENT_TIMESTAMP
        ),
        (
            'Khuyến cáo phòng ngừa bệnh đường hô hấp giao mùa',
            'Thời tiết chuyển mùa là điều kiện thuận lợi cho các bệnh lý hô hấp ở trẻ em và người cao tuổi. Khoa Nhi và Tai Mũi Họng MEDICARE khuyến cáo tiêm chủng đầy đủ, giữ ấm cơ thể và đeo khẩu trang nơi công cộng.',
            CURRENT_TIMESTAMP - INTERVAL '1 day'
        ),
        (
            'Quy trình xét nghiệm cận lâm sàng nhanh chóng và tiện lợi',
            'Hệ thống xét nghiệm tự động tại MEDICARE liên kết trực tiếp kết quả với hồ sơ bệnh án điện tử, giúp giảm thiểu tối đa thời gian chờ đợi và bảo mật thông tin tuyệt đối cho người bệnh.',
            CURRENT_TIMESTAMP - INTERVAL '2 days'
        )
) AS v(tieu_de, noi_dung, ngay_dang)
WHERE NOT EXISTS (
    SELECT 1 FROM "TinTuc" t WHERE t.tieu_de = v.tieu_de
);
