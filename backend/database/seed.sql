-- =============================================================================
-- HEALTHCARE APPOINTMENT SYSTEM - MINIMAL SEED DATA (BASELINE V1)
-- Master data cơ bản phục vụ khởi tạo hệ thống (Idempotent seed)
-- =============================================================================

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
