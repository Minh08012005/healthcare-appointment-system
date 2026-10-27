import { useEffect } from "react";
import BookingIcon from "../booking/BookingIcons";
import { formatDateTime } from "./appointmentHelpers";

// Popup xác nhận hủy lịch. Không cho đóng khi đang gửi request.
function ConfirmCancelModal({ appointment, submitting, error, onConfirm, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  return (
    <div className="ap-modal-backdrop" onClick={() => !submitting && onClose()}>
      <div
        className="ap-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ap-cancel-title"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="ap-modal__icon">
          <BookingIcon name="info" size={26} />
        </span>
        <h2 id="ap-cancel-title">Hủy lịch hẹn?</h2>
        <p className="ap-modal__text">
          Bạn sắp hủy lịch khám với <strong>BS. {appointment.bac_si_ten || "—"}</strong> lúc{" "}
          <strong>{formatDateTime(appointment)}</strong>.
        </p>
        <p className="ap-modal__warn">
          Hành động này không thể hoàn tác. Mã QR sẽ không còn hợp lệ và khung giờ sẽ được trả lại.
        </p>

        {error && (
          <div className="ap-modal__error" role="alert">
            {error}
          </div>
        )}

        <div className="ap-modal__actions">
          <button type="button" className="ap-btn ap-btn--ghost" onClick={onClose} disabled={submitting}>
            Giữ lịch hẹn
          </button>
          <button type="button" className="ap-btn ap-btn--danger" onClick={onConfirm} disabled={submitting}>
            {submitting ? "Đang hủy..." : "Xác nhận hủy"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmCancelModal;
