import { formatTime } from "../booking/bookingFormat";

// Trạng thái hiển thị. Backend C2-08A chỉ trả "Đã đặt" | "Đã hủy".
// "Quá hạn check-in" = lịch vẫn "Đã đặt" nhưng backend không còn trả qr_code
// (còn dưới 10 phút tới giờ hẹn hoặc đã qua giờ hẹn).
export const STATUS_META = {
  booked: { label: "Đã đặt", tone: "booked" },
  cancelled: { label: "Đã hủy", tone: "cancelled" },
  expired: { label: "Quá hạn check-in", tone: "expired" },
  other: { label: "", tone: "other" },
};

export function getStatusKey(appointment) {
  if (appointment.trang_thai === "Đã hủy") return "cancelled";
  if (appointment.trang_thai === "Đã đặt") return appointment.qr_code ? "booked" : "expired";
  return "other";
}

export function getStatusLabel(appointment) {
  const key = getStatusKey(appointment);
  return key === "other" ? appointment.trang_thai || "—" : STATUS_META[key].label;
}

// "2026-10-20" -> "20/10/2026"
export function formatShortDate(iso) {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

// ("09:00:00", "2026-10-20") -> "09:00, 20/10/2026"
export function formatDateTime(appointment) {
  return `${formatTime(appointment.gio_kham)}, ${formatShortDate(appointment.ngay_kham)}`;
}
