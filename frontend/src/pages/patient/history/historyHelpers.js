// Nhãn hiển thị tiếng Việt cho trạng thái chỉ định xét nghiệm (API trả mã chuẩn)
export const LAB_STATUS = {
  CHO_XU_LY: { label: "Chờ xử lý", tone: "wait" },
  DANG_XU_LY: { label: "Đang xử lý", tone: "doing" },
  DA_XONG: { label: "Đã có kết quả", tone: "done" },
};

export function getLabStatus(code) {
  return LAB_STATUS[code] || { label: "—", tone: "wait" };
}

// "2026-11-17T03:00:00.000Z" -> "10:00, 17/11/2026" (giờ Việt Nam)
export function formatLabTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
