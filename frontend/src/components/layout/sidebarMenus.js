export const sidebarMenus = {
  receptionist: {
    roleLabel: "LỄ TÂN",
    items: [
      { path: "/receptionist", label: "Trang chủ", title: "Trang chủ lễ tân" },
      { path: "/receptionist/check-in-online", label: "Check-in online" },
      { path: "/receptionist/walk-in", label: "Tiếp đón offline" },
      { path: "/receptionist/queue", label: "Hàng đợi" },
    ],
  },
  doctor: {
    roleLabel: "BÁC SĨ",
    items: [
      { path: "/doctor", label: "Danh sách bệnh nhân" },
      { path: "/doctor/call", label: "Gọi bệnh nhân" },
      { path: "/doctor/schedule", label: "Lịch trực" },
    ],
  },
  lab: {
    roleLabel: "XÉT NGHIỆM",
    items: [
      { path: "/lab", label: "Danh sách chờ" },
      { path: "/lab/orders", label: "Chỉ định xét nghiệm" },
      { path: "/lab/results", label: "Kết quả / xử lý" },
    ],
  },
  admin: {
    roleLabel: "ADMIN",
    items: [
      { path: "/admin", label: "Dashboard" },
      { path: "/admin/accounts", label: "Tài khoản" },
      { path: "/admin/specialties", label: "Chuyên khoa" },
      { path: "/admin/doctors", label: "Bác sĩ" },
      { path: "/admin/rooms", label: "Phòng" },
      { path: "/admin/schedules", label: "Lịch trực" },
      { path: "/admin/time-slots", label: "Khung giờ" },
      { path: "/admin/queue-settings", label: "Cấu hình hàng đợi" },
      { path: "/admin/overview", label: "Tổng thể lịch" },
      { path: "/admin/content", label: "Nội dung" },
    ],
  },
    patient: {
    roleLabel: "BỆNH NHÂN",
    items: [{ path: "/patient", label: "Trang chủ", title: "Trang chủ bệnh nhân" }],
  },
};