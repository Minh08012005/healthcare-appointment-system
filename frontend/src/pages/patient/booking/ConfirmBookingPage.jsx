import { useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import BookingHeader from "./BookingHeader";
import BookingIcon from "./BookingIcons";
import { BOOKING_PATHS } from "./bookingPaths";
import { formatDate, formatFee, formatTime, getInitials } from "./bookingFormat";
import { useBooking } from "../../../booking/useBooking";
import { useAuth } from "../../../auth/useAuth";
import { appointmentApi } from "../../../api/appointments";
import "./booking.css";

// Phân loại lỗi theo bảng mã lỗi trong contract C2-06
function classifyError(err) {
  const status = err?.status;
  const message = err?.message || "Đặt lịch thất bại. Vui lòng thử lại.";

  if (!status) return { type: "network", message }; // fetch lỗi mạng: apiClient không gắn status
  if (status === 401) {
    return { type: "auth", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
  }
  if (status === 409 && message.includes("hết chỗ")) return { type: "full", message };
  // 404 không tìm thấy lịch, 409 lịch không còn hoạt động, 400 đã qua / còn dưới 10 phút
  if (
    status === 404 ||
    status === 409 ||
    (status === 400 && (message.includes("đã qua") || message.includes("10 phút")))
  ) {
    return { type: "invalid", message };
  }
  return { type: "failed", message };
}

// BN12 — Xác nhận đặt lịch
function ConfirmBookingPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { selection, info, result, selectSlot, completeBooking } = useBooking();
  const { specialty, doctor, date, slot } = selection;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const submittingRef = useRef(false); // chặn double-click trước khi state kịp render lại

  // Thiếu selection (F5 / vào thẳng URL / vừa đặt xong)
  if (!slot || !doctor || !date) {
    if (result) return <Navigate to={BOOKING_PATHS.success} replace />;
    return <Navigate to={doctor ? BOOKING_PATHS.slot : BOOKING_PATHS.specialty} replace />;
  }
  // Chưa nhập đủ BN11
  if (info.su_dung_bhyt === null || !info.trieu_chung.trim()) {
    return <Navigate to={BOOKING_PATHS.patientInfo} replace />;
  }

  const specialtyName = specialty?.ten_chuyen_khoa ?? doctor.ten_chuyen_khoa;
  const blocked = error?.type === "full" || error?.type === "invalid";

  const handleConfirm = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const res = await appointmentApi.create({
        lich_kham_id: slot.lich_kham_id,
        trieu_chung: info.trieu_chung.trim(),
      });
      completeBooking(res.data);
      navigate(BOOKING_PATHS.success, { replace: true });
    } catch (err) {
      setError(classifyError(err));
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleChooseOtherSlot = () => {
    selectSlot(null);
    navigate(BOOKING_PATHS.slot);
  };

  const handleRelogin = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="booking">
      <BookingHeader
        title="Xác nhận đặt lịch"
        step={5}
        label="Xác nhận"
        onBack={submitting ? undefined : () => navigate(BOOKING_PATHS.patientInfo)}
      />

      <main className="booking__main">
        <div className="bk-intro">
          <BookingIcon name="badgeCheck" size={26} />
          <div>
            <h2>Kiểm tra thông tin</h2>
            <p>Vui lòng rà soát chi tiết phiếu hẹn trước khi hoàn tất</p>
          </div>
        </div>

        <section className="bk-card">
          <h3 className="bk-card-title">
            <BookingIcon name="user" size={16} />
            Thông tin bệnh nhân
          </h3>
          <div className="bk-row">
            <span>Họ và tên</span>
            <strong className="bk-strong">{user?.ho_ten ?? "—"}</strong>
          </div>
          <div className="bk-row">
            <span>Số điện thoại</span>
            <strong>{user?.so_dien_thoai || "Chưa cập nhật"}</strong>
          </div>
        </section>

        <section className="bk-card">
          <div className="bk-card-head">
            <h3 className="bk-card-title">
              <BookingIcon name="medical" size={16} />
              Thông tin khám bệnh
            </h3>
            <span className="bk-pill">Ngoại trú</span>
          </div>

          <div className="bk-doctor">
            <span className="bk-avatar">{getInitials(doctor.ho_ten)}</span>
            <div>
              <div className="bk-doctor-name">BS. {doctor.ho_ten}</div>
              <small className="bk-link">Chuyên khoa {specialtyName}</small>
            </div>
          </div>

          <div className="bk-row">
            <span>Chuyên khoa</span>
            <strong>{specialtyName}</strong>
          </div>
          <div className="bk-row">
            <span>Phòng khám</span>
            <strong>{slot.ten_phong ?? "—"}</strong>
          </div>
          <div className="bk-row bk-row--highlight">
            <span className="bk-row-label">
              <BookingIcon name="calendar" size={14} />
              Thời gian
            </span>
            <span className="bk-row-stack">
              <strong className="bk-accent">
                {formatTime(slot.gio_bat_dau)} - {formatTime(slot.gio_ket_thuc)}
              </strong>
              <small>{formatDate(date)}</small>
            </span>
          </div>
          <div className="bk-row">
            <span>Bảo hiểm y tế (BHYT)</span>
            {info.su_dung_bhyt ? (
              <span className="bk-status bk-status--ok">
                <BookingIcon name="checkCircle" size={12} />
                Được áp dụng
              </span>
            ) : (
              <span className="bk-status">Không áp dụng</span>
            )}
          </div>
          <div className="bk-row">
            <span>Phí khám (tham khảo)</span>
            <strong className="bk-accent">{formatFee(doctor.muc_phi)}</strong>
          </div>
          <div className="bk-row">
            <span>Triệu chứng ban đầu</span>
            <em>{info.trieu_chung.trim()}</em>
          </div>
        </section>

        <div className="bk-note">
          <span className="bk-note-icon">
            <BookingIcon name="clock" size={16} />
          </span>
          <div>
            <strong>LƯU Ý QUAN TRỌNG</strong>
            <p>
              Vui lòng check-in trước giờ hẹn tối thiểu <b>10 phút</b>, nếu không mã QR tiếp đón
              sẽ hết hiệu lực.
            </p>
          </div>
        </div>

        {error && (
          <div className="bk-alert" role="alert">
            <p>
              {error.type === "full" && "Khung giờ vừa hết chỗ. "}
              {error.type === "invalid" && "Khung giờ không còn hợp lệ. "}
              {error.message}
            </p>
            {blocked && (
              <button type="button" className="bk-btn bk-btn--outline" onClick={handleChooseOtherSlot}>
                Chọn khung giờ khác
              </button>
            )}
            {error.type === "auth" && (
              <button type="button" className="bk-btn bk-btn--outline" onClick={handleRelogin}>
                Đăng nhập lại
              </button>
            )}
          </div>
        )}

        <div className="bk-actions">
          <button
            type="button"
            className="bk-btn bk-btn--primary"
            disabled={submitting || blocked}
            onClick={handleConfirm}
          >
            {submitting ? (
              "Đang đặt lịch..."
            ) : (
              <>
                <BookingIcon name="checkCircle" size={16} />
                Xác nhận đặt lịch
              </>
            )}
          </button>
          <button
            type="button"
            className="bk-btn bk-btn--white"
            disabled={submitting}
            onClick={() => navigate(BOOKING_PATHS.patientInfo)}
          >
            Quay lại
          </button>
        </div>
      </main>
    </div>
  );
}

export default ConfirmBookingPage;