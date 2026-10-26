import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import BookingIcon from "./BookingIcons";
import { BOOKING_PATHS } from "./bookingPaths";
import { formatDate, formatTime } from "./bookingFormat";
import { useBooking } from "../../../booking/useBooking";
import "./booking.css";

// Logo dấu "+" ở giữa QR như Figma (chỉ trang trí, nội dung QR vẫn là qr_code từ backend)
const QR_LOGO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1a62c9"/><path d="M12 6.5v11M6.5 12h11" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>',
  );

// BN13 — Đặt lịch thành công + QR (dữ liệu lấy từ response C2-06)
function BookingSuccessPage() {
  const navigate = useNavigate();
  const { result, resetBooking } = useBooking();
  const qrRef = useRef(null);
  const [copied, setCopied] = useState(false);

  // F5 / vào thẳng URL: không có kết quả đặt lịch -> về trang chủ bệnh nhân
  if (!result?.appointment) {
    return <Navigate to={BOOKING_PATHS.home} replace />;
  }

  const { appointment, doctor, specialty, room } = result;

  const goTo = (path) => {
    resetBooking();
    navigate(path, { replace: true });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appointment.ma_dat_lich);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // trình duyệt chặn clipboard (http không phải localhost) -> bỏ qua
    }
  };

  const handleSaveQr = () => {
    const canvas = qrRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${appointment.ma_dat_lich}.png`;
    link.click();
  };

  return (
    <div className="booking">
      <header className="bk-result-header">
        <h1>Kết quả đặt lịch</h1>
        <button type="button" aria-label="Đóng" onClick={() => goTo(BOOKING_PATHS.home)}>
          <BookingIcon name="x" size={20} />
        </button>
      </header>

      <main className="booking__main">
        <div className="bk-success">
          <span className="bk-success-icon">
            <BookingIcon name="check" size={28} />
          </span>
          <h2>Đặt lịch thành công</h2>
          <p>
            <BookingIcon name="qr" size={13} />
            Hãy mang mã QR này khi đến viện
          </p>
        </div>

        <section className="bk-card bk-ticket">
          <span className="bk-ticket-tag">THẺ KHÁM ĐIỆN TỬ</span>
          <div className="bk-qr-box">
            {appointment.qr_code ? (
              <QRCodeCanvas
                ref={qrRef}
                value={appointment.qr_code}
                size={150}
                level="H"
                fgColor="#1f2937"
                bgColor="#eef3fb"
                marginSize={0}
                imageSettings={{ src: QR_LOGO, width: 30, height: 30, excavate: true }}
              />
            ) : (
              <p className="bk-muted">Chưa có mã QR.</p>
            )}
          </div>
          <small className="bk-muted">Mã lịch hẹn</small>
          <div className="bk-code-row">
            <strong className="bk-code">{appointment.ma_dat_lich}</strong>
            <button type="button" onClick={handleCopy} aria-label="Sao chép mã lịch hẹn">
              <BookingIcon name={copied ? "check" : "copy"} size={15} />
            </button>
          </div>
          {appointment.qr_code && (
            <div className="bk-save-bar">
              <button type="button" onClick={handleSaveQr}>
                <BookingIcon name="download" size={13} />
                Lưu mã QR
              </button>
            </div>
          )}
        </section>

        <section className="bk-card">
          <div className="bk-summary">
            <span className="bk-icon-box">
              <BookingIcon name="medical" size={22} />
            </span>
            <div>
              {specialty?.ten_chuyen_khoa && (
                <span className="bk-pill">Khám {specialty.ten_chuyen_khoa}</span>
              )}
              <div className="bk-doctor-name">{doctor?.ho_ten ? `BS. ${doctor.ho_ten}` : "—"}</div>
              <div className="bk-meta">
                <BookingIcon name="clock" size={13} />
                {formatTime(appointment.gio_kham)} • {formatDate(appointment.ngay_kham)}
              </div>
            </div>
          </div>
          <div className="bk-place">
            <BookingIcon name="mapPin" size={15} />
            <strong>{room?.ten_phong ?? "Phòng khám chưa cập nhật"}</strong>
          </div>
          <div className="bk-checkin">
            <BookingIcon name="shieldCheck" size={15} />
            <span>Check-in tại quầy lễ tân trước giờ hẹn 10 phút để lấy số thứ tự khám.</span>
          </div>
        </section>

        <div className="bk-actions">
          <button
            type="button"
            className="bk-btn bk-btn--primary"
            onClick={() => goTo(BOOKING_PATHS.appointments)}
          >
            <BookingIcon name="calendar" size={16} />
            Xem lịch đã đặt
          </button>
          <button type="button" className="bk-btn bk-btn--soft" onClick={() => goTo(BOOKING_PATHS.home)}>
            <BookingIcon name="home" size={16} />
            Về trang chủ
          </button>
        </div>
      </main>
    </div>
  );
}

export default BookingSuccessPage;