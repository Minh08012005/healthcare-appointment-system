import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { getPostLoginPath } from "../../auth/authPaths";
import MedicareBrand from "../../components/brand/MedicareBrand";
import "./auth.css";

function NotFoundPage() {
  const { user } = useAuth();

  const targetPath = user?.role ? getPostLoginPath(user.role) : "/";
  const actionLabel = user ? "Về trang làm việc" : "Về trang chủ";

  return (
    <div className="auth">
      <div className="auth__screen">
        <div className="auth__brand-wrap">
          <MedicareBrand size="default" />
        </div>

        <div className="auth__portal-tag-row">
          <span className="auth__portal-badge auth__portal-badge--warning">
            404 · KHÔNG TÌM THẤY TRANG
          </span>
        </div>

        <h1 className="auth__title">Không tìm thấy trang</h1>
        <p className="auth__desc">
          Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển sang địa chỉ khác trong hệ thống MEDICARE.
        </p>

        <div className="auth__actions">
          <Link to={targetPath} className="auth__btn">
            {actionLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
