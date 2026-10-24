const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { getJwtSecret } = require("../config/jwt");

const ROLE_BENH_NHAN = "Bệnh nhân";
const STATUS_ACTIVE = "HoatDong";

const isString = (v) => typeof v === "string";
const isOptionalString = (v) => v === undefined || v === null || typeof v === "string";
// Chuỗi rỗng/chỉ khoảng trắng -> null (tránh lưu "" vào cột UNIQUE như email, số điện thoại)
const cleanOptional = (v) => (isString(v) && v.trim() !== "" ? v.trim() : null);

const signToken = (user, secret) =>
  jwt.sign({ id: user.id, role: user.vai_tro }, secret, { expiresIn: "1d" });

const register = async (req, res) => {
  const body = req.body || {};
  const { username, password, ho_ten, email, so_dien_thoai, ngay_sinh, gioi_tinh, dia_chi } = body;

  // 1. Kiểm tra kiểu dữ liệu (bắt buộc là chuỗi)
  if (!isString(username) || !isString(password) || !isString(ho_ten)) {
    return res.status(400).json({
      success: false,
      message: "username, password và ho_ten là bắt buộc và phải là chuỗi",
    });
  }
  if (![email, so_dien_thoai, ngay_sinh, gioi_tinh, dia_chi].every(isOptionalString)) {
    return res.status(400).json({
      success: false,
      message: "email, so_dien_thoai, ngay_sinh, gioi_tinh, dia_chi phải là chuỗi",
    });
  }

  // 2. Trim rồi mới validate; dùng giá trị đã trim khi lưu
  const usernameTrim = username.trim();
  const hoTenTrim = ho_ten.trim();

  if (usernameTrim === "" || hoTenTrim === "") {
    return res
      .status(400)
      .json({ success: false, message: "Username và họ tên không được để trống" });
  }
  if (usernameTrim.length > 50) {
    return res.status(400).json({ success: false, message: "Username tối đa 50 ký tự" });
  }
  if (password.length < 6 || password.length > 72) {
    return res
      .status(400)
      .json({ success: false, message: "Mật khẩu phải từ 6 đến 72 ký tự" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const role = await client.query(
      `SELECT id FROM "VaiTro" WHERE ten_vai_tro = $1`,
      [ROLE_BENH_NHAN]
    );
    if (role.rowCount === 0) {
      await client.query("ROLLBACK");
      return res
        .status(500)
        .json({ success: false, message: "Chưa có vai trò Bệnh nhân trong DB" });
    }

    const hash = await bcrypt.hash(password, 10);

    const tk = await client.query(
      `INSERT INTO "TaiKhoan" (ten_dang_nhap, mat_khau, email, so_dien_thoai, vai_tro_id, trang_thai)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [usernameTrim, hash, cleanOptional(email), cleanOptional(so_dien_thoai), role.rows[0].id, STATUS_ACTIVE]
    );

    await client.query(
      `INSERT INTO "BenhNhan" (tai_khoan_id, ho_ten, ngay_sinh, gioi_tinh, dia_chi)
       VALUES ($1, $2, $3, $4, $5)`,
      [tk.rows[0].id, hoTenTrim, cleanOptional(ngay_sinh), cleanOptional(gioi_tinh), cleanOptional(dia_chi)]
    );

    await client.query("COMMIT");
    return res
      .status(201)
      .json({ success: true, data: { message: "Đăng ký thành công" } });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      let message = "Thông tin đã tồn tại";
      if (err.constraint && err.constraint.includes("ten_dang_nhap")) message = "Username đã tồn tại";
      else if (err.constraint && err.constraint.includes("email")) message = "Email đã được sử dụng";
      else if (err.constraint && err.constraint.includes("so_dien_thoai")) message = "Số điện thoại đã được sử dụng";
      return res.status(409).json({ success: false, message });
    }
    if (err.code === "22001") {
      return res.status(400).json({ success: false, message: "Dữ liệu nhập quá dài" });
    }
    if (err.code === "22007" || err.code === "22008") {
      return res.status(400).json({ success: false, message: "Ngày sinh không hợp lệ" });
    }

    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  const secret = getJwtSecret();
  if (!secret) {
    console.error("LỖI CẤU HÌNH: thiếu JWT_SECRET trong backend/.env");
    return res
      .status(500)
      .json({ success: false, message: "Lỗi cấu hình server: thiếu JWT_SECRET" });
  }

  const { username, password } = req.body || {};
  if (
    !isString(username) ||
    !isString(password) ||
    username.trim() === "" ||
    password === ""
  ) {
    return res.status(400).json({
      success: false,
      message: "username và password là bắt buộc và phải là chuỗi",
    });
  }

  try {
    const result = await pool.query(
      `SELECT tk.id, tk.ten_dang_nhap, tk.mat_khau, tk.trang_thai, vt.ten_vai_tro AS vai_tro
       FROM "TaiKhoan" tk
       JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id
       WHERE tk.ten_dang_nhap = $1`,
      [username.trim()]
    );

    const user = result.rows[0];
    const ok = user && (await bcrypt.compare(password, user.mat_khau));
    if (!ok) {
      return res
        .status(401)
        .json({ success: false, message: "Sai username hoặc password" });
    }
    if (user.trang_thai !== STATUS_ACTIVE) {
      return res
        .status(403)
        .json({ success: false, message: "Tài khoản không được phép đăng nhập" });
    }

    return res.json({
      success: true,
      data: {
        token: signToken(user, secret),
        user: { id: user.id, username: user.ten_dang_nhap, role: user.vai_tro },
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

const me = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tk.id, tk.ten_dang_nhap AS username, tk.email, tk.so_dien_thoai,
              tk.trang_thai, vt.ten_vai_tro AS role,
              bn.id AS benh_nhan_id, bn.ho_ten
       FROM "TaiKhoan" tk
       JOIN "VaiTro" vt ON vt.id = tk.vai_tro_id
       LEFT JOIN "BenhNhan" bn ON bn.tai_khoan_id = tk.id
       WHERE tk.id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];
    if (!user || user.trang_thai !== STATUS_ACTIVE) {
      return res
        .status(401)
        .json({ success: false, message: "Tài khoản không hợp lệ" });
    }
    return res.json({ success: true, data: { user } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

const logout = (req, res) => {
  // Token lưu ở client; client xóa token là đăng xuất
  return res.json({ success: true, data: { message: "Đăng xuất thành công" } });
};

module.exports = { register, login, me, logout };