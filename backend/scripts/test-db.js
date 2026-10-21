const pool = require("../src/config/db");

async function testConnection() {
  console.log("Đang kiểm tra kết nối tới PostgreSQL trên Neon...");

  try {
    // Thực hiện truy vấn đơn giản để lấy thời gian hiện tại từ PostgreSQL server
    const result = await pool.query("SELECT NOW() AS current_time, version() AS pg_version;");
    
    console.log(" Kết nối thành công tới Neon PostgreSQL!");
    console.log(" Thời gian máy chủ DB:", result.rows[0].current_time);
    console.log(" Phiên bản PostgreSQL:", result.rows[0].pg_version.split(" on ")[0]);
  } catch (error) {
    console.error(" Kết nối thất bại!");
    console.error("Chi tiết lỗi:", error.message);
    process.exitCode = 1;
  } finally {
    // Đóng pool để giải phóng tài nguyên và kết thúc chương trình
    await pool.end();
  }
}

testConnection();
