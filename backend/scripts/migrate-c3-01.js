const pool = require("../src/config/db");

const ALLOWED_STATUSES = [
  "Đã đặt",
  "Đã hủy",
  "DA_DAT",
  "DA_CHECK_IN",
  "QUA_HAN_CHECK_IN",
  "DA_HUY",
  "HOAN_THANH",
];

async function migrateC301() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2026102901)");

    const invalidStates = await client.query(
      `SELECT DISTINCT trang_thai
       FROM "DatLichKham"
       WHERE trang_thai IS NULL OR NOT (trang_thai = ANY($1::text[]))`,
      [ALLOWED_STATUSES]
    );
    if (invalidStates.rowCount > 0) {
      throw new Error(
        `Phát hiện state DatLichKham chưa có mapping an toàn: ${invalidStates.rows
          .map((row) => String(row.trang_thai))
          .join(", ")}. Dừng migration để Minh xác nhận.`
      );
    }

    await client.query(`
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

      UPDATE "DatLichKham" SET trang_thai = 'DA_DAT' WHERE trang_thai = 'Đã đặt';
      UPDATE "DatLichKham" SET trang_thai = 'DA_HUY' WHERE trang_thai = 'Đã hủy';

      INSERT INTO "CauHinhHeThong"
        ("ti_le_online", "ti_le_offline", "checkin_som_nhat_phut",
         "checkin_toi_thieu_phut", "so_lan_goi_toi_da",
         "khoang_cach_goi_phut", "chu_ky_quet_phut")
      SELECT 1, 1, 60, 10, 3, 1, 1
      WHERE NOT EXISTS (SELECT 1 FROM "CauHinhHeThong");
    `);

    await client.query("COMMIT");
    console.log("C3-01 schema/state/config migration: PASS");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("C3-01 migration dừng:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateC301();
