// Nhận number (C2-03) hoặc chuỗi NUMERIC "150000.00" (C2-06)
export function formatFee(fee) {
  if (fee === null || fee === undefined || fee === "") return "Chưa cập nhật";
  const value = Number(fee);
  if (Number.isNaN(value)) return "Chưa cập nhật";
  return `${value.toLocaleString("vi-VN")}đ`;
}

const LONG_WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const pad = (n) => String(n).padStart(2, "0");

// "2026-10-20" -> "Thứ Ba, 20/10/2026"
export function formatDate(iso) {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return `${LONG_WEEKDAYS[d.getDay()]}, ${pad(day)}/${pad(month)}/${year}`;
}

// "16:25:54" | "16:25" -> "16:25"
export function formatTime(time) {
  return time ? time.slice(0, 5) : "—";
}

// "Trần Thu Hà" -> "TH"
export function getInitials(fullName) {
  const words = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Heading của dải ngày. Dải có thể vắt qua tháng mới nên phải hiện đủ 2 tháng:
//   cùng tháng   -> "Tháng 10, 2026"
//   khác tháng   -> "Tháng 10 – 11, 2026"
//   khác năm     -> "Tháng 12, 2026 – Tháng 1, 2027"
export function formatMonthRange(options) {
  if (!options || options.length === 0) return "";
  const first = options[0];
  const last = options[options.length - 1];

  if (first.year !== last.year) {
    return `Tháng ${first.month}, ${first.year} – Tháng ${last.month}, ${last.year}`;
  }
  if (first.month === last.month) {
    return `Tháng ${first.month}, ${first.year}`;
  }
  return `Tháng ${first.month} – ${last.month}, ${first.year}`;
}

// Bỏ dấu tiếng Việt để tìm kiếm: "Hạnh" -> "hanh"
export function removeDiacritics(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}