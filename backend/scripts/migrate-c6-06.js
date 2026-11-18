const pool = require("../src/config/db");

// C6-06: bảng CauHinhKhungGio — template khung giờ khám chuẩn + capacity cho lịch trực MỚI (UC-030/UC-031).
// Chạy lặp an toàn (IF NOT EXISTS / ON CONFLICT DO NOTHING: không ghi đè cấu hình Admin đã sửa).
// Cùng nội dung với cuối database/schema.sql. Không đụng LichKhamBacSi.
const SQL = `
-- -----------------------------------------------------------------------------
-- NHÓM 8: CẤU HÌNH KHUNG GIỜ & SLOT (C6-06)
-- -----------------------------------------------------------------------------
-- Template cho lịch trực mới: 8 khung 1 tiếng theo UC-030 (sáng 06-11, chiều 13-16),
-- mỗi khung có so_slot_toi_da / so_slot_online riêng (UC-031). Offline = toi_da - online (không lưu).
-- Sửa cấu hình KHÔNG ghi đè capacity của LichKhamBacSi đã tồn tại.
CREATE TABLE IF NOT EXISTS "CauHinhKhungGio" (
    "id" SERIAL PRIMARY KEY,
    "ca" VARCHAR(10) NOT NULL CHECK ("ca" IN ('SANG', 'CHIEU')),
    "gio_bat_dau" TIME NOT NULL UNIQUE,
    "gio_ket_thuc" TIME NOT NULL,
    "so_slot_toi_da" INTEGER NOT NULL,
    "so_slot_online" INTEGER NOT NULL,
    "ngay_cap_nhat" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ck_khunggio_thoi_gian" CHECK ("gio_ket_thuc" > "gio_bat_dau"),
    CONSTRAINT "ck_khunggio_slot" CHECK (
        "so_slot_toi_da" > 0 AND "so_slot_online" >= 0 AND "so_slot_online" <= "so_slot_toi_da"
    )
);

-- 8 khung mặc định, capacity 6/4 = đúng giá trị seed LichKhamBacSi hiện tại
INSERT INTO "CauHinhKhungGio" ("ca", "gio_bat_dau", "gio_ket_thuc", "so_slot_toi_da", "so_slot_online") VALUES
    ('SANG',  '06:00', '07:00', 6, 4),
    ('SANG',  '07:00', '08:00', 6, 4),
    ('SANG',  '08:00', '09:00', 6, 4),
    ('SANG',  '09:00', '10:00', 6, 4),
    ('SANG',  '10:00', '11:00', 6, 4),
    ('CHIEU', '13:00', '14:00', 6, 4),
    ('CHIEU', '14:00', '15:00', 6, 4),
    ('CHIEU', '15:00', '16:00', 6, 4)
ON CONFLICT ("gio_bat_dau") DO NOTHING;
`;

async function migrateC606() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2026111706)");

    console.log("1. Tạo bảng CauHinhKhungGio + 8 khung giờ mặc định (không ghi đè dữ liệu đã có)...");
    await client.query(SQL);
    const r = await client.query(`SELECT COUNT(*)::int AS n FROM "CauHinhKhungGio"`);
    console.log(`   Số khung giờ hiện có: ${r.rows[0].n}`);

    await client.query("COMMIT");
    console.log("C6-06 migration: PASS");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("C6-06 migration dừng:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateC606();