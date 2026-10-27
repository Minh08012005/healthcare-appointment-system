import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";

// Khối thông báo dùng chung cho trạng thái loading / lỗi / trống.
export function LoadingState({ text = "Đang tải..." }) {
  return (
    <div className="ap-state" role="status">
      <span className="ap-spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry, onBack, backLabel = "Quay lại" }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const expired = error?.status === 401;

  const relogin = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="ap-state ap-state--error" role="alert">
      <h3>{expired ? "Phiên đăng nhập đã hết hạn" : "Không tải được dữ liệu"}</h3>
      <p>{error?.message || "Đã có lỗi xảy ra. Vui lòng thử lại."}</p>
      <div className="ap-state__actions">
        {expired ? (
          <button type="button" className="ap-btn ap-btn--primary" onClick={relogin}>
            Đăng nhập lại
          </button>
        ) : (
          onRetry && (
            <button type="button" className="ap-btn ap-btn--primary" onClick={onRetry}>
              Thử lại
            </button>
          )
        )}
        {onBack && (
          <button type="button" className="ap-btn ap-btn--ghost" onClick={onBack}>
            {backLabel}
          </button>
        )}
      </div>
    </div>
  );
}
