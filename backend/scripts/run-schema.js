const fs = require("fs");
const path = require("path");
const pool = require("../src/config/db");

async function runSchema() {
  const schemaPath = path.resolve(__dirname, "../database/schema.sql");

  console.log("=== BẮT ĐẦU THỰC THI SCHEMA TRÊN NEON POSTGRESQL ===");
  console.log(`- Đường dẫn file schema: ${schemaPath}`);

  if (!fs.existsSync(schemaPath)) {
    console.error(`LỖI: Không tìm thấy file schema tại ${schemaPath}`);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const sqlContent = fs.readFileSync(schemaPath, "utf8");
  console.log(`- Đã đọc schema.sql (${sqlContent.length} bytes, ${sqlContent.split("\n").length} dòng).`);

  let client;
  try {
    console.log("- Đang lấy client kết nối từ connection pool...");
    client = await pool.connect();

    console.log("- Đang thực thi schema.sql trong transaction (BEGIN ... COMMIT)...");
    await client.query("BEGIN");
    await client.query(sqlContent);
    await client.query("COMMIT");

    console.log(" THỰC THI SCHEMA.SQL THÀNH CÔNG TRÊN NEON POSTGRESQL!");
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
        console.log("- Đã rollback transaction do phát sinh lỗi.");
      } catch (rollbackErr) {
        console.error("Lỗi khi rollback:", rollbackErr.message);
      }
    }

    console.error(" LỖI KHI THỰC THI SCHEMA.SQL:");
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

runSchema();
