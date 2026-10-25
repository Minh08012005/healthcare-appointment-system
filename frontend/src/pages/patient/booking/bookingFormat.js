export function formatFee(fee) {
  if (fee === null || fee === undefined) return "Chưa cập nhật";
  return `${fee.toLocaleString("vi-VN")}đ`;
}

// "Trần Thu Hà" -> "TH"
export function getInitials(fullName) {
  const words = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Bỏ dấu tiếng Việt để tìm kiếm: "Hạnh" -> "hanh"
export function removeDiacritics(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}