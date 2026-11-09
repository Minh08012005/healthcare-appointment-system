import { useEffect, useRef, useState } from "react";
import { examinationApi } from "../../../api/examination";
import "../call/callPatient.css"; // tái dùng cp-btn, cp-notice
import "./examResult.css";

const MAX_LEN = 10000; // khớp giới hạn của API C4-04

const FIELDS = [
  { key: "trieu_chung_ghi_nhan", label: "Triệu chứng ghi nhận", placeholder: "Ví dụ: Ho kéo dài 5 ngày, sốt nhẹ về chiều" },
  { key: "chan_doan", label: "Chẩn đoán", placeholder: "Ví dụ: Viêm phế quản cấp" },
  { key: "loi_dan", label: "Lời dặn", placeholder: "Ví dụ: Nghỉ ngơi, uống nhiều nước, tái khám sau 1 tuần" },
  { key: "don_thuoc", label: "Đơn thuốc", placeholder: "Ví dụ: Paracetamol 500mg x 2 viên/ngày" },
];

// Dữ liệu từ Backend (null = chưa có) -> giá trị ô nhập
const toValues = (ketQua) =>
  Object.fromEntries(FIELDS.map(({ key }) => [key, ketQua?.[key] ?? ""]));

const saveErrorText = (err) => {
  if (err?.status === 400) return err.message || "Dữ liệu kết quả khám không hợp lệ.";
  if (err?.status === 403) return "Bạn không có quyền cập nhật kết quả khám của hồ sơ này.";
  if (err?.status === 404) return "Không tìm thấy hồ sơ khám.";
  if (err?.status === 409) return "Hồ sơ không còn ở trạng thái đang khám nên không thể lưu.";
  return err?.message || "Không lưu được kết quả khám. Vui lòng thử lại.";
};

// C4-05: nhập và lưu kết quả khám (gọi API C4-04). Chỉ được render khi hồ sơ DANG_KHAM.
// `ketQua` là dữ liệu Backend trả về khi mở hồ sơ -> F5 vẫn tải lại đúng dữ liệu đã lưu.
function ExamResultForm({ hoSoId, ketQua, onRecordStale }) {
  // saved = bản mới nhất đã lưu ở Backend; values = nội dung đang nhập
  const [saved, setSaved] = useState(() => toValues(ketQua));
  const [values, setValues] = useState(() => toValues(ketQua));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success" | "error", text }
  const savingRef = useRef(false); // khóa chống bấm đúp (đồng bộ, không chờ render)

  // Chỉ gửi những trường đã thay đổi (so sánh sau khi trim, giống cách Backend lưu)
  const changed = FIELDS.map(({ key }) => key).filter((k) => values[k].trim() !== saved[k]);
  const dirty = changed.length > 0;

  // Cảnh báo khi đóng/tải lại tab lúc còn nội dung chưa lưu
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (savingRef.current || !dirty) return;

    const body = Object.fromEntries(changed.map((k) => [k, values[k].trim()]));
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const res = await examinationApi.saveResult(hoSoId, body);
      const next = toValues(res?.data?.ket_qua_kham);
      setSaved(next);
      setValues(next); // hiển thị đúng dữ liệu Backend đã lưu (đã trim)
      setMessage({ type: "success", text: "Đã lưu kết quả khám." });
    } catch (err) {
      setMessage({ type: "error", text: saveErrorText(err) });
      // Hồ sơ không còn DANG_KHAM (đã đóng ở nơi khác): tải lại hồ sơ để form tự chuyển sang chỉ xem
      if (err?.status === 409 && onRecordStale) onRecordStale();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form className="er-form" onSubmit={handleSubmit} noValidate>
      {FIELDS.map(({ key, label, placeholder }) => (
        <div className="er-field" key={key}>
          <label htmlFor={`er-${key}`}>{label}</label>
          <textarea
            id={`er-${key}`}
            rows={key === "chan_doan" ? 2 : 3}
            value={values[key]}
            maxLength={MAX_LEN}
            placeholder={placeholder}
            disabled={saving}
            onChange={(e) => handleChange(key, e.target.value)}
          />
        </div>
      ))}

      {message && (
        <div
          className={`cp-notice ${message.type === "success" ? "cp-notice--success" : "cp-notice--error"}`}
          role={message.type === "success" ? "status" : "alert"}
        >
          {message.text}
        </div>
      )}

      <div className="er-actions">
        {dirty && !saving && <span className="er-hint">Có thay đổi chưa lưu</span>}
        <button type="submit" className="cp-btn cp-btn--primary" disabled={saving || !dirty}>
          {saving ? "Đang lưu..." : "Lưu kết quả khám"}
        </button>
      </div>
    </form>
  );
}

export default ExamResultForm;
