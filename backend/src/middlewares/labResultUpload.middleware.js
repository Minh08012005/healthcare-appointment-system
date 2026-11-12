const multer = require("multer");
const { MAX_FILE_SIZE } = require("../utils/labResultFile");

// C5-03: nhận multipart/form-data cho API nộp kết quả xét nghiệm.
// Field file: "file" (đúng 1 file). Field text: "mo_ta" (không bắt buộc).
// File giữ trong RAM (tối đa 10MB) và CHỈ được ghi ra đĩa sau khi qua mọi kiểm tra ở controller,
// nên request bị từ chối không để lại file rác.

const ROLE_XET_NGHIEM = "Xét nghiệm";

const fail = (res, status, message, code) =>
  res.status(status).json({ success: false, message, ...(code ? { code } : {}) });

// Chặn sớm theo vai trò, trước khi đọc body upload
const requireLabStaff = (req, res, next) => {
  if (!req.user || req.user.role !== ROLE_XET_NGHIEM) {
    return fail(res, 403, "Chỉ nhân viên phòng xét nghiệm mới được thực hiện thao tác này");
  }
  return next();
};

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 5, parts: 6, fieldSize: 100 * 1024 },
}).single("file");

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: [413, `File vượt quá giới hạn ${MAX_FILE_SIZE / 1024 / 1024}MB`, "FILE_TOO_LARGE"],
  LIMIT_UNEXPECTED_FILE: [400, 'Chỉ nhận đúng 1 file trong field "file"', "INVALID_UPLOAD"],
  LIMIT_FILE_COUNT: [400, 'Chỉ nhận đúng 1 file trong field "file"', "INVALID_UPLOAD"],
  LIMIT_PART_COUNT: [400, "Request upload có quá nhiều phần", "INVALID_UPLOAD"],
  LIMIT_FIELD_COUNT: [400, "Request upload có quá nhiều trường", "INVALID_UPLOAD"],
  LIMIT_FIELD_VALUE: [400, "Giá trị trường quá dài", "INVALID_UPLOAD"],
  LIMIT_FIELD_KEY: [400, "Tên trường quá dài", "INVALID_UPLOAD"],
};

const parseResultUpload = (req, res, next) => {
  parser(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const [status, message, code] = MULTER_MESSAGES[err.code] || [400, "Request upload không hợp lệ", "INVALID_UPLOAD"];
      return fail(res, status, message, code);
    }
    // Body multipart hỏng / bị cắt giữa chừng
    return fail(res, 400, "Request upload không hợp lệ", "INVALID_UPLOAD");
  });
};

module.exports = { requireLabStaff, parseResultUpload };
