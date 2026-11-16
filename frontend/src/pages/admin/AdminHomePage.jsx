import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import "./admin.css";

const ADMIN_MODULES = [
  {
    path: "/admin/accounts",
    label: "Tài khoản nhân viên",
    tag: "C6-03",
    description: "Quản lý danh sách, tạo mới, chỉnh sửa thông tin và khóa tài khoản nhân viên y tế.",
  },
  {
    path: "/admin/specialties",
    label: "Chuyên khoa",
    tag: "C6-02",
    description: "Quản lý danh mục các chuyên khoa khám bệnh, tạo mới và cập nhật thông tin mô tả.",
  },
  {
    path: "/admin/doctors",
    label: "Bác sĩ",
    tag: "C6-02",
    description: "Quản lý hồ sơ bác sĩ, phân bổ chuyên khoa, thiết lập mức phí khám và cấp bậc chuyên môn.",
  },
  {
    path: "/admin/rooms",
    label: "Phòng",
    tag: "C6-04",
    description: "Quản lý danh mục phòng khám bệnh và các phòng xét nghiệm, chẩn đoán hình ảnh.",
  },
  {
    path: "/admin/schedules",
    label: "Lịch trực",
    tag: "C6-07",
    description: "Phân công ca khám và lịch làm việc của bác sĩ theo ngày, ca và phòng khám.",
  },
  {
    path: "/admin/time-slots",
    label: "Khung giờ & Slot",
    tag: "C6-06",
    description: "Cấu hình khung giờ hoạt động và thiết lập phân bổ số lượng slot đặt khám.",
  },
  {
    path: "/admin/queue-settings",
    label: "Cấu hình hệ thống",
    tag: "C6-05",
    description: "Cấu hình quy tắc điều phối hàng đợi khám bệnh, tỉ lệ online/offline và mốc check-in.",
  },
  {
    path: "/admin/overview",
    label: "Tổng quan lịch",
    tag: "C6-07",
    description: "Xem bức tranh tổng thể lịch khám của tất cả bác sĩ theo ngày hoặc tuần.",
  },
  {
    path: "/admin/content",
    label: "Nội dung",
    tag: "C6-09",
    description: "Quản lý tin tức bệnh viện và quy trình hướng dẫn khám bệnh cho bệnh nhân.",
  },
];

function AdminHomePage() {
  const { user } = useAuth();
  const displayName = user?.ho_ten || user?.username || "Quản trị viên";

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <span className="admin-header__badge">Khu vực quản trị</span>
        <h1 className="admin-header__title">Chào mừng, {displayName}</h1>
        <p className="admin-header__desc">
          Hệ thống Quản trị Bệnh viện MEDICARE. Chọn một module bên dưới để quản lý dữ liệu và cấu hình hệ thống.
        </p>
      </header>

      <section>
        <h2 className="admin-section__title">Danh mục quản lý & Cấu hình</h2>
        <div className="admin-modules-grid">
          {ADMIN_MODULES.map((mod) => (
            <Link key={mod.path} to={mod.path} className="admin-module-card">
              <div>
                <div className="admin-module-card__header">
                  <span className="admin-module-card__tag">{mod.tag}</span>
                </div>
                <h3 className="admin-module-card__title">{mod.label}</h3>
                <p className="admin-module-card__desc">{mod.description}</p>
              </div>
              <span className="admin-module-card__action">
                Truy cập <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminHomePage;
