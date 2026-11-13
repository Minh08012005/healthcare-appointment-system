// Trạng thái chỉ định theo Backend C5-02/C5-03
export const LAB_STATUS = {
  CHO_XU_LY: { label: "Chờ xử lý", className: "lab-pill--wait" },
  DANG_XU_LY: { label: "Đang xử lý", className: "lab-pill--doing" },
  DA_XONG: { label: "Đã xong", className: "lab-pill--done" },
};

export const statusLabel = (value) => LAB_STATUS[value]?.label || value || "—";

export const show = (v) => (v === null || v === undefined || v === "" ? "—" : v);

// ISO timestamp -> "08:25 12/11/2026"
export const formatDateTime = (iso) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// "2026-11-12" -> "12/11/2026"
export const formatDate = (v) => {
  if (typeof v !== "string" || v.length < 10) return "—";
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const statusClass = (value) => `lab-pill ${LAB_STATUS[value]?.className || ""}`;