import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { getPostLogoutPath, getPostLoginPath } from "../auth/authPaths";
import MedicareBrand from "../components/brand/MedicareBrand";
import "../pages/common/auth.css";

function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth" style={{ minHeight: "100vh" }}>
        <div className="auth__loading" role="status" aria-live="polite">
          <MedicareBrand size="default" />
          <div className="auth__loading-row">
            <span className="auth__spinner" aria-hidden="true" />
            <span>Đang kiểm tra đăng nhập...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    const unauthPath = getPostLogoutPath(role);
    return <Navigate to={unauthPath} replace />;
  }

  if (role && user.role !== role) {
    const workspacePath = getPostLoginPath(user.role) || "/";
    return (
      <div className="auth">
        <div className="auth__screen">
          <div className="auth__brand-wrap">
            <MedicareBrand size="default" />
          </div>

          <div className="auth__portal-tag-row">
            <span className="auth__portal-badge auth__portal-badge--error">
              403 · KHÔNG CÓ QUYỀN TRUY CẬP
            </span>
          </div>

          <h1 className="auth__title">Không có quyền truy cập</h1>
          <p className="auth__desc">
            Tài khoản hiện tại không có quyền truy cập khu vực này.
          </p>

          <div className="auth__actions">
            <Link to={workspacePath} className="auth__btn">
              Về trang làm việc của bạn
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
