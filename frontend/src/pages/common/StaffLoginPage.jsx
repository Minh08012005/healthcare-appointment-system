import LoginForm from "../../components/auth/LoginForm";
import { STAFF_ROLES } from "../../auth/authPaths";

function StaffLoginPage() {
  return (
    <LoginForm
      portalType="staff"
      badgeText="CỔNG BỆNH VIỆN"
      title="Đăng nhập hệ thống"
      desc="Không gian làm việc dành cho nhân viên y tế và quản trị MEDICARE."
      allowedRoles={STAFF_ROLES}
      brandSubtitle="Không gian làm việc chuyên môn"
      backTo="/"
      backLabel="Về trang MEDICARE"
      staffNote="Tài khoản nhân viên được cấp và quản lý bởi Quản trị viên hệ thống."
      showRegisterLink={false}
      publicLinks={[
        { to: "/procedure", label: "Quy trình khám bệnh" },
      ]}
    />
  );
}

export default StaffLoginPage;
