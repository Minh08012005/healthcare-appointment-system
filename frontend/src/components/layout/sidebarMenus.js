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
      { path: "/lab", label: "Danh sách xét nghiệm", title: "Danh sách xét nghiệm" },
    ],
  },
  admin: {
    roleLabel: "ADMIN",
    items: [
      { path: "/admin", label: "Dashboard", title: "Khu vực quản trị" },
      { path: "/admin/accounts", label: "Tài khoản nhân viên", title: "Quản lý tài khoản nhân viên" },
      { path: "/admin/specialties", label: "Chuyên khoa", title: "Quản lý chuyên khoa" },
      { path: "/admin/doctors", label: "Bác sĩ", title: "Quản lý bác sĩ" },
      { path: "/admin/rooms", label: "Phòng", title: "Quản lý phòng" },
      { path: "/admin/schedules", label: "Lịch trực", title: "Quản lý lịch trực" },
      { path: "/admin/time-slots", label: "Khung giờ & Slot", title: "Cấu hình khung giờ & Slot" },
      { path: "/admin/queue-settings", label: "Cấu hình hệ thống", title: "Cấu hình hệ thống" },
      { path: "/admin/overview", label: "Tổng quan lịch", title: "Tổng quan lịch khám" },
      { path: "/admin/content", label: "Nội dung", title: "Quản lý nội dung" },
    ],
  },
    patient: {
    roleLabel: "BỆNH NHÂN",
    items: [
      { path: "/patient", label: "Trang chủ", title: "Trang chủ bệnh nhân" },
      { path: "/patient/appointments", label: "Lịch hẹn", title: "Lịch hẹn của tôi" },
    ],
  },
};