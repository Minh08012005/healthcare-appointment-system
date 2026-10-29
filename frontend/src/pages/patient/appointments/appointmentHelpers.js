import { formatTime } from "../booking/bookingFormat";

// State API dùng mã chuẩn; UI luôn hiển thị nhãn tiếng Việt.
export const STATUS_META = {
  booked: { label: "Đã đặt", tone: "booked" },
  checkedIn: { label: "Đã check-in", tone: "booked" },
  cancelled: { label: "Đã hủy", tone: "cancelled" },
  expired: { label: "Quá hạn check-in", tone: "expired" },
  completed: { label: "Hoàn thành", tone: "booked" },
  other: { label: "", tone: "other" },
};

export function getStatusKey(appointment) {
  const keys = {
    DA_DAT: "booked",
    DA_CHECK_IN: "checkedIn",
    QUA_HAN_CHECK_IN: "expired",
    DA_HUY: "cancelled",
    HOAN_THANH: "completed",
  };
  return keys[appointment.trang_thai] || "other";
}

export function getStatusLabel(appointment) {
  const key = getStatusKey(appointment);
  return key === "other" ? "—" : STATUS_META[key].label;
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
