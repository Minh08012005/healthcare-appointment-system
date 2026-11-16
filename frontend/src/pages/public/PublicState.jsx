// Khối thông báo loading / lỗi / trống dùng chung cho các trang công khai (C6-10).
export function PublicLoading({ text = "Đang tải..." }) {
  return (
    <div className="pc-state" role="status">
      <span className="pc-spinner" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

export function PublicError({ error, onRetry }) {
  return (
    <div className="pc-state pc-state--error" role="alert">
      <h2>Không tải được nội dung</h2>
      <p>{error?.message || "Đã có lỗi xảy ra. Vui lòng thử lại."}</p>
      {onRetry && (
        <button type="button" className="pc-btn pc-btn--outline" onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function PublicEmpty({ title, text }) {
  return (
    <div className="pc-state">
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}
