import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import { PatientLoading, PatientError, PatientEmpty } from "../../../components/patient/PatientState";

// Khối thông báo dùng chung cho trạng thái loading / lỗi / trống (tương thích Phase 1).
export function LoadingState({ text = "Đang tải..." }) {
  return <PatientLoading text={text} />;
}

export function ErrorState({ error, onRetry, onBack, backLabel = "Quay lại" }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const expired = error?.status === 401;

  const relogin = async () => {
    const res = await logout("Bệnh nhân");
    navigate(res?.redirectPath || "/login", { replace: true });
  };

  return (
    <PatientError
      error={error}
      onRetry={expired ? undefined : onRetry}
      onBack={expired ? relogin : onBack}
      backLabel={expired ? "Đăng nhập lại" : backLabel}
    />
  );
}

export function EmptyState({
  title = "Chưa có dữ liệu",
  description = "",
  icon = "medical",
  actionText,
  onAction,
  children,
}) {
  return (
    <PatientEmpty
      title={title}
      description={description}
      icon={icon}
      actionText={actionText}
      onAction={onAction}
    >
      {children}
    </PatientEmpty>
  );
}

