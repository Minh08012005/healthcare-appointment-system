// Lấy JWT_SECRET từ môi trường; trả về chuỗi rỗng nếu chưa cấu hình
const getJwtSecret = () => (process.env.JWT_SECRET || "").trim();

module.exports = { getJwtSecret };