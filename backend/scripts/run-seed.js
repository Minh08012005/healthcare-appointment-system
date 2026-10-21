const fs = require("fs");
const path = require("path");
const pool = require("../src/config/db");

async function runSeed() {
  const seedPath = path.resolve(__dirname, "../database/seed.sql");

  console.log("=== BẮT ĐẦU THỰC THI SEED DATA TRÊN NEON POSTGRESQL ===");
  console.log(`- Đường dẫn file seed: ${seedPath}`);

  if (!fs.existsSync(seedPath)) {
    console.error(`LỖI: Không tìm thấy file seed tại ${seedPath}`);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const sqlContent = fs.readFileSync(seedPath, "utf8");
  console.log(`- Đã đọc seed.sql (${sqlContent.length} bytes, ${sqlContent.split("\n").length} dòng).`);

  let client;
  try {
    console.log("- Đang lấy client kết nối từ connection pool...");
    client = await pool.connect();

    console.log("- Đang thực thi seed.sql trong transaction (BEGIN ... COMMIT)...");
    await client.query("BEGIN");
    await client.query(sqlContent);
    await client.query("COMMIT");

    console.log(" THỰC THI SEED.SQL THÀNH CÔNG TRÊN NEON POSTGRESQL!");
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
        console.log("- Đã rollback transaction do phát sinh lỗi.");
      } catch (rollbackErr) {
        console.error("Lỗi khi rollback:", rollbackErr.message);
      }
    }

    console.error(" LỖI KHI THỰC THI SEED.SQL:");
    console.error("- Error Message:", error.message);
    if (error.code) console.error("- Error Code:", error.code);
    if (error.position) console.error("- Error Position:", error.position);
    if (error.detail) console.error("- Error Detail:", error.detail);
    if (error.hint) console.error("- Error Hint:", error.hint);
    if (error.where) console.error("- Error Where:", error.where);

    process.exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runSeed();
