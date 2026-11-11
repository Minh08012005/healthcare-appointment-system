const pool = require("../src/config/db");

async function migrateC501() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2026111101)");

    console.log("1. Bổ sung các cột mới vào ChiDinhXetNghiem (NULLABLE)...");
    await client.query(`
      ALTER TABLE "ChiDinhXetNghiem"
        ADD COLUMN IF NOT EXISTS "nhan_vien_xu_ly_id" INTEGER REFERENCES "TaiKhoan"("id"),
        ADD COLUMN IF NOT EXISTS "thoi_gian_bat_dau" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "thoi_gian_hoan_thanh" TIMESTAMPTZ;
    `);

    console.log("2. Bổ sung cột phong_kham_id vào TaiKhoan (NULLABLE)...");
    await client.query(`
      ALTER TABLE "TaiKhoan"
        ADD COLUMN IF NOT EXISTS "phong_kham_id" INTEGER REFERENCES "PhongKham"("id");
    `);

    console.log("3. Bổ sung ràng buộc UNIQUE cho KetQuaXetNghiem(chi_dinh_id)...");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_ketquaxetnghiem_chidinh'
        ) THEN
          ALTER TABLE "KetQuaXetNghiem"
            ADD CONSTRAINT "uq_ketquaxetnghiem_chidinh" UNIQUE ("chi_dinh_id");
        END IF;
      END $$;
    `);

    await client.query("COMMIT");
    console.log("C5-01 migration: PASS");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("C5-01 migration dừng:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateC501();

