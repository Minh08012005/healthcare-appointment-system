const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// C5-03: lưu file kết quả xét nghiệm trên đĩa (backend/uploads/lab-results/).
// Cột KetQuaXetNghiem.file_ket_qua lưu đường dẫn TƯƠNG ĐỐI "lab-results/<tên file>".
// File chỉ được tải xuống qua API có xác thực, không public thư mục uploads.

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads"));
const RESULT_DIR_NAME = "lab-results";
const RESULT_DIR = path.join(UPLOAD_ROOT, RESULT_DIR_NAME);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_MO_TA = 10000;

// Loại file được phép (nhận diện bằng chữ ký byte, KHÔNG tin tên file / Content-Type của client)
const FILE_TYPES = {
  pdf: { mime: "application/pdf", label: "PDF" },
  jpg: { mime: "image/jpeg", label: "JPEG" },
  png: { mime: "image/png", label: "PNG" },
  webp: { mime: "image/webp", label: "WebP" },
};

const detectFileType = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") {
    return "webp";
  }
  return null;
};

// Tên file do server sinh (không dùng tên client): kqxn-<chiDinhId>-<thời gian>-<ngẫu nhiên>.<ext>
const saveResultFile = async (chiDinhId, buffer, ext) => {
  await fs.promises.mkdir(RESULT_DIR, { recursive: true });
  const name = `kqxn-${chiDinhId}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await fs.promises.writeFile(path.join(RESULT_DIR, name), buffer, { flag: "wx" });
  return `${RESULT_DIR_NAME}/${name}`;
};

const STORED_PATTERN = /^lab-results\/kqxn-\d+-\d+-[0-9a-f]{12}\.(pdf|jpg|png|webp)$/;

// Đường dẫn tuyệt đối từ giá trị lưu trong DB; null nếu giá trị lạ (chống path traversal)
const resolveStoredPath = (stored) => {
  if (typeof stored !== "string" || !STORED_PATTERN.test(stored)) return null;
  const abs = path.resolve(UPLOAD_ROOT, stored);
  return abs.startsWith(RESULT_DIR + path.sep) ? abs : null;
};

const extOfStored = (stored) => {
  const ext = typeof stored === "string" ? stored.split(".").pop() : "";
  return FILE_TYPES[ext] ? ext : null;
};

const removeStoredFile = async (stored) => {
  const abs = resolveStoredPath(stored);
  if (abs) await fs.promises.unlink(abs).catch(() => {});
};

module.exports = {
  UPLOAD_ROOT,
  RESULT_DIR,
  MAX_FILE_SIZE,
  MAX_MO_TA,
  FILE_TYPES,
  detectFileType,
  saveResultFile,
  resolveStoredPath,
  extOfStored,
  removeStoredFile,
};
