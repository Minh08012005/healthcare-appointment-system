import BookingIcon from "../../pages/patient/booking/BookingIcons";
import "./PatientState.css";

/**
 * Standard loading indicator for Patient Portal
 */
export function PatientLoading({ text = "Đang tải dữ liệu...", className = "" }) {
  return (
    <div
      className={`patient-state patient-state--loading ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="patient-spinner" aria-hidden="true" />
      <p className="patient-state__text">{text}</p>
    </div>
  );
}

/**
 * Standard empty state for Patient Portal
 */
export function PatientEmpty({
  title = "Chưa có dữ liệu",
  description = "",
  icon = "medical",
  actionText,
  onAction,
  actionTo,
  className = "",
  children,
}) {
  return (
    <div className={`patient-state patient-state--empty ${className}`}>
      <span className="patient-state__icon-box" aria-hidden="true">
        {typeof icon === "string" ? <BookingIcon name={icon} size={28} /> : icon}
      </span>
      <h3 className="patient-state__title">{title}</h3>
      {description && <p className="patient-state__desc">{description}</p>}
      {children}
      {actionText && (onAction || actionTo) && (
        <div className="patient-state__actions">
          {actionTo ? (
            <a href={actionTo} className="patient-btn patient-btn--primary">
              {actionText}
            </a>
          ) : (
            <button
              type="button"
              className="patient-btn patient-btn--primary"
              onClick={onAction}
            >
              {actionText}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Standard error state for Patient Portal
 */
export function PatientError({
  title = "Không tải được dữ liệu",
  message = "Đã có lỗi xảy ra. Vui lòng thử lại.",
  error,
  onRetry,
  onBack,
  backLabel = "Quay lại",
  className = "",
  children,
}) {
  const displayMsg = error?.message || message;
  const isAuthError = error?.status === 401;
  const displayTitle = isAuthError ? "Phiên đăng nhập đã hết hạn" : title;

  return (
    <div
      className={`patient-state patient-state--error ${className}`}
      role="alert"
    >
      <span
        className="patient-state__icon-box patient-state__icon-box--error"
        aria-hidden="true"
      >
        <BookingIcon name="info" size={26} />
      </span>
      <h3 className="patient-state__title">{displayTitle}</h3>
      {displayMsg && <p className="patient-state__desc">{displayMsg}</p>}
      {children}
      <div className="patient-state__actions">
        {onRetry && (
          <button
            type="button"
            className="patient-btn patient-btn--primary"
            onClick={onRetry}
          >
            Thử lại
          </button>
        )}
        {onBack && (
          <button
            type="button"
            className="patient-btn patient-btn--secondary"
            onClick={onBack}
          >
            {backLabel}
          </button>
        )}
      </div>
    </div>
  );
}
