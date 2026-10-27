import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import BookingIcon from "../booking/BookingIcons";
import { BOOKING_PATHS } from "../booking/bookingPaths";
import { formatDate, formatFee, formatTime, getInitials } from "../booking/bookingFormat";
import { appointmentApi } from "../../../api/appointments";
import { useFetch } from "../../../api/useFetch";
import ConfirmCancelModal from "./ConfirmCancelModal";
import { ErrorState, LoadingState } from "./StateMessage";
import { getStatusKey, getStatusLabel } from "./appointmentHelpers";
import "../booking/booking.css";
import "./appointments.css";

// Logo dấu "+" ở giữa QR (giống BN13)
const QR_LOGO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1a62c9"/><path d="M12 6.5v11M6.5 12h11" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>',
  );

// BN15 — Chi tiết lịch hẹn + QR + Hủy lịch (API C2-08A: GET :id, PATCH :id/cancel)
function AppointmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qrRef = useRef(null);
  const submittingRef = useRef(false); // khóa chống double-click (đồng bộ, không chờ render)

  const { data, error, loading, reload } = useFetch(appointmentApi.detailPath(id));
  const [cancelled, setCancelled] = useState(false); // đã hủy thành công trong phiên này
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [notice, setNotice] = useState(null); // { type: "success" | "error", text }
  const [copied, setCopied] = useState(false);

  const goList = () => navigate(BOOKING_PATHS.appointments);

  // Sau khi hủy: cập nhật ngay UI theo kết quả backend (Đã hủy, QR mất hiệu lực)
  const appointment = data
    ? cancelled
      ? { ...data, trang_thai: "Đã hủy", qr_code: null, co_the_huy: false }
      : data
    : null;

  const openModal = () => {
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submittingRef.current) return;
    setModalOpen(false);
  };

  const handleCancel = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setModalError("");
    try {
      await appointmentApi.cancel(id);
      setCancelled(true);
      setModalOpen(false);
      setNotice({ type: "success", text: "Đã hủy lịch hẹn thành công. Mã QR không còn hợp lệ." });
    } catch (err) {
      if (err?.status === 400 || err?.status === 404 || err?.status === 409) {
        // Quá hạn hủy / đã hủy trước đó / không tồn tại: báo lỗi và tải lại trạng thái thật
        setModalOpen(false);
        setNotice({ type: "error", text: err.message });
        reload();
      } else {
        setModalError(err?.message || "Không hủy được lịch hẹn. Vui lòng thử lại.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSaveQr = () => {
    const canvas = qrRef.current;
    if (!canvas || !appointment) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${appointment.ma_dat_lich}.png`;
    link.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appointment.ma_dat_lich);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // trình duyệt chặn clipboard -> bỏ qua
    }
  };

  const statusKey = appointment ? getStatusKey(appointment) : "other";

  return (
    <div className="booking ap-detail">
      <header className="ap-detail__header">
        <button type="button" className="ap-back" onClick={goList} aria-label="Quay lại danh sách">
          ←
        </button>
        <h1>Chi tiết lịch hẹn</h1>
      </header>

      <main className="booking__main">
        {loading && <LoadingState text="Đang tải chi tiết lịch hẹn..." />}

        {!loading && error && (
          <ErrorState error={error} onRetry={reload} onBack={goList} backLabel="Về danh sách lịch hẹn" />
        )}

        {!loading && !error && appointment && (
          <>
            {notice && (
              <div className={`ap-notice ap-notice--${notice.type}`} role="status">
                {notice.text}
              </div>
            )}

            <section className="bk-card ap-qr-card">
              <div className="ap-qr-card__top">
                <span className={`ap-badge ap-badge--${statusKey}`}>{getStatusLabel(appointment)}</span>
                <button type="button" className="ap-code" onClick={handleCopy} aria-label="Sao chép mã lịch hẹn">
                  Mã: {appointment.ma_dat_lich}
                  <BookingIcon name={copied ? "check" : "copy"} size={13} />
                </button>
              </div>

              {appointment.qr_code ? (
                <>
                  <div className="bk-qr-box">
                    <QRCodeCanvas
                      ref={qrRef}
                      value={appointment.qr_code}
                      size={170}
                      level="H"
                      fgColor="#1f2937"
                      bgColor="#eef3fb"
                      marginSize={0}
                      imageSettings={{ src: QR_LOGO, width: 34, height: 34, excavate: true }}
                    />
                  </div>
                  <p className="ap-qr-hint">
                    <BookingIcon name="qr" size={13} />
                    Đưa mã này cho nhân viên khi check-in
                  </p>
                  <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={handleSaveQr}>
                    <BookingIcon name="download" size={14} />
                    Lưu ảnh QR
                  </button>
                </>
              ) : (
                <div className="ap-qr-invalid">
                  <span className="ap-qr-invalid__icon">
                    <BookingIcon name="x" size={26} />
                  </span>
                  <strong>Mã QR không còn hợp lệ</strong>
                  <p>
                    {statusKey === "cancelled"
                      ? "Lịch hẹn này đã được hủy."
                      : "Lịch hẹn đã quá hạn check-in (còn dưới 10 phút hoặc đã qua giờ hẹn)."}
                  </p>
                </div>
              )}
            </section>

            <section className="bk-card">
              <div className="bk-card-title">
                <BookingIcon name="medical" size={18} />
                <strong>Thông tin khám bệnh</strong>
              </div>

              <div className="ap-doctor">
                <span className="ap-avatar">{getInitials(appointment.bac_si_ten)}</span>
                <div>
                  <strong>BS. {appointment.bac_si_ten || "—"}</strong>
                  <span>
                    {[appointment.cap_bac, appointment.ten_chuyen_khoa && `Chuyên khoa: ${appointment.ten_chuyen_khoa}`]
                      .filter(Boolean)
                      .join(" · ") || "Chưa cập nhật"}
                  </span>
                </div>
              </div>

              <div className="bk-row">
                <span>Khoa</span>
                <strong className="bk-strong">{appointment.ten_chuyen_khoa || "Chưa cập nhật"}</strong>
              </div>
              <div className="bk-row">
                <span>Phòng khám</span>
                <strong className="bk-strong ap-blue">{appointment.ten_phong || "Chưa cập nhật"}</strong>
              </div>
              <div className="bk-row">
                <span>Thời gian</span>
                <div className="bk-row-stack">
                  <strong className="bk-strong">{formatTime(appointment.gio_kham)}</strong>
                  <small className="bk-muted">{formatDate(appointment.ngay_kham)}</small>
                </div>
              </div>
              <div className="bk-row">
                <span>Phí khám</span>
                <strong className="bk-strong">{formatFee(appointment.phi_kham)}</strong>
              </div>
              {appointment.trieu_chung && (
                <div className="ap-symptom">
                  <small>TRIỆU CHỨNG BAN ĐẦU</small>
                  <p>{appointment.trieu_chung}</p>
                </div>
              )}
            </section>

            <div className="bk-note">
              <span className="bk-note-icon">
                <BookingIcon name="info" size={16} />
              </span>
              <div>
                <strong>Lưu ý quan trọng</strong>
                <p>
                  Vui lòng đến trước giờ hẹn tối thiểu 10 phút, nếu không mã QR tiếp đón sẽ hết hiệu lực phục vụ.
                </p>
              </div>
            </div>

            {statusKey === "cancelled" ? (
              <p className="ap-cancel-hint">Lịch hẹn này đã được hủy.</p>
            ) : (
              <div className="ap-cancel-zone">
                <p className="ap-cancel-hint">
                  <BookingIcon name="info" size={13} />
                  {appointment.co_the_huy
                    ? "Chỉ được phép hủy lịch hẹn trước giờ khám 2 tiếng."
                    : "Đã quá thời hạn hủy (cần hủy trước giờ khám ít nhất 2 tiếng)."}
                </p>
                <button
                  type="button"
                  className="ap-btn ap-btn--danger-outline"
                  onClick={openModal}
                  disabled={!appointment.co_the_huy}
                >
                  <BookingIcon name="x" size={16} />
                  Hủy lịch hẹn
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {modalOpen && appointment && (
        <ConfirmCancelModal
          appointment={appointment}
          submitting={submitting}
          error={modalError}
          onConfirm={handleCancel}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default AppointmentDetailPage;
