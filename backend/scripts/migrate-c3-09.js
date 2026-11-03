const pool = require("../src/config/db");

async function migrateC309() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(2026110309)");
    await client.query(`
      ALTER TABLE "HangDoi"
        ADD COLUMN IF NOT EXISTS "thoi_gian_goi_gan_nhat" TIMESTAMPTZ;
    `);
    await client.query("COMMIT");
    console.log("C3-09 thoi_gian_goi_gan_nhat migration: PASS");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("C3-09 migration dừng:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateC309();
