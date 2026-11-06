const pool = require("../src/config/db");

async function migrateC401() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2026110601)");

    // 1. Thêm các cột mới nếu chưa tồn tại
    await client.query(`
      ALTER TABLE "ChiDinhXetNghiem"
        ADD COLUMN IF NOT EXISTS "ten_xet_nghiem" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "ghi_chu" TEXT,
        ADD COLUMN IF NOT EXISTS "thoi_gian_chi_dinh" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    `);

    // 2. Backfill an toàn nếu có dữ liệu cũ null trước khi set NOT NULL
    await client.query(`
      UPDATE "ChiDinhXetNghiem"
      SET "ten_xet_nghiem" = 'Chưa xác định'
      WHERE "ten_xet_nghiem" IS NULL;
    `);

    // 3. Đặt ràng buộc NOT NULL cho ten_xet_nghiem
    await client.query(`
      ALTER TABLE "ChiDinhXetNghiem"
        ALTER COLUMN "ten_xet_nghiem" SET NOT NULL;
    `);

    await client.query("COMMIT");
    console.log("C4-01 ChiDinhXetNghiem migration: PASS");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("C4-01 migration dừng:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateC401();

