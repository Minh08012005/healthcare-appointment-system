import { useLocation } from "react-router-dom";
import LoginForm from "../../components/auth/LoginForm";
import { PATIENT_ROLES } from "../../auth/authPaths";

function LoginPage() {
  const location = useLocation();

  const successNotice = location.state?.registered ? (
    <div className="auth__alert auth__alert--success" role="status">
      Đăng ký thành công, mời bạn đăng nhập.
    </div>
  ) : null;

  return (
    <LoginForm
      portalType="patient"
      badgeText="CỔNG BỆNH NHÂN"
      title="Chào mừng bạn trở lại"
      desc="Đăng nhập để quản lý lịch hẹn và theo dõi quá trình khám bệnh."
      allowedRoles={PATIENT_ROLES}
      brandSubtitle="Chăm sóc sức khỏe thuận tiện hơn"
      backTo="/"
      backLabel="Về trang chủ"
      showRegisterLink={true}
      notice={successNotice}
      publicLinks={[
        { to: "/news", label: "Tin tức" },
        { to: "/procedure", label: "Quy trình khám bệnh" },
      ]}
    />
  );
}

export default LoginPage;
