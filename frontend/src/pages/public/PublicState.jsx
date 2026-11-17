import { PatientLoading, PatientError, PatientEmpty } from "../../components/patient/PatientState";

// Khối thông báo loading / lỗi / trống dùng chung cho các trang công khai (tương thích Phase 1).
export function PublicLoading({ text = "Đang tải..." }) {
  return <PatientLoading text={text} />;
}

export function PublicError({ error, onRetry }) {
  return (
    <PatientError
      title="Không tải được nội dung"
      error={error}
      onRetry={onRetry}
    />
  );
}

export function PublicEmpty({ title, text }) {
  return <PatientEmpty title={title} description={text} icon="info" />;
}

