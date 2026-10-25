const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/jwt");

const authenticate = (req, res, next) => {
  const secret = getJwtSecret();
  if (!secret) {
    console.error("LỖI CẤU HÌNH: thiếu JWT_SECRET trong backend/.env");
    return res
      .status(500)
      .json({ success: false, message: "Lỗi cấu hình server: thiếu JWT_SECRET" });
  }

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Chưa đăng nhập" });
  }

  try {
    req.user = jwt.verify(token, secret); // { id, role }
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

module.exports = { authenticate };