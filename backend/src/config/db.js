const { Pool } = require("pg");
const path = require("path");

// Tự động nạp file .env từ thư mục backend
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  console.error("LỖI: Không tìm thấy biến DATABASE_URL trong backend/.env");
}

// Khởi tạo Connection Pool kết nối đến PostgreSQL trên Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Bắt buộc cho kết nối SSL với Neon
  },
});

module.exports = pool;
