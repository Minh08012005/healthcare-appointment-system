import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { appointmentApi } from "../../api/appointments";
import { useFetch } from "../../api/useFetch";
import BookingIcon from "./booking/BookingIcons";
import { BOOKING_PATHS } from "./booking/bookingPaths";
import { getInitials } from "./booking/bookingFormat";
import {
  formatDateTime,
  getStatusKey,
  getStatusLabel,
} from "./appointments/appointmentHelpers";
import "./patientHome.css";

function PatientHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(appointmentApi.listPath());

  const displayName = user?.ho_ten || user?.username || "Quý khách";

  const { activeAppointment, totalCount } = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    // Tìm lịch hẹn đang hiệu lực sắp tới (Đã đặt hoặc Đã check-in)
    const active = list.find((a) => {
      const key = getStatusKey(a);
      return key === "booked" || key === "checkedIn";
    });
    return {
      activeAppointment: active || null,
      totalCount: list.length,
    };
  }, [data]);

  return (
    <div className="ph-page">
      {/* 1. Welcome Header */}
      <section className="ph-welcome">
        <div className="ph-welcome__body">
          <h1 className="ph-welcome__title">
            Xin chào, <span className="ph-welcome__name">{displayName}</span>!
          </h1>
          <p className="ph-welcome__sub">
            Chào mừng bạn đến với Cổng thông tin người bệnh MEDICARE. Đăng ký và quản lý lịch khám bệnh trực tuyến dễ dàng.
          </p>
        </div>
      </section>

      {/* 2. Primary Actions */}
      <section className="ph-actions-grid" aria-label="Thao tác chính">
        <button
          type="button"
          className="ph-action-card ph-action-card--featured"
          onClick={() => navigate(BOOKING_PATHS.specialty)}
        >
          <div className="ph-action-card__top">
            <div className="ph-action-card__icon-box" aria-hidden="true">
              <BookingIcon name="calendar" size={24} />
            </div>
            <div className="ph-action-card__content">
              <h2 className="ph-action-card__title">Đặt lịch khám mới</h2>
              <p className="ph-action-card__desc">
                Chọn chuyên khoa, bác sĩ và khung giờ khám thuận tiện nhất
              </p>
            </div>
          </div>
          <span className="ph-action-card__cta">
            Đặt lịch ngay <BookingIcon name="arrowRight" size={14} />
          </span>
        </button>

        <button
          type="button"
          className="ph-action-card"
          onClick={() => navigate(BOOKING_PATHS.appointments)}
        >
          <div className="ph-action-card__top">
            <div
              className="ph-action-card__icon-box ph-action-card__icon-box--secondary"
              aria-hidden="true"
            >
              <BookingIcon name="clock" size={24} />
            </div>
            <div className="ph-action-card__content">
              <h2 className="ph-action-card__title">Lịch hẹn của tôi</h2>
              <p className="ph-action-card__desc">
                Theo dõi lịch khám đã đăng ký, mã tiếp đón QR và phòng khám
              </p>
            </div>
          </div>
          <span className="ph-action-card__cta">
            {totalCount > 0 ? `Xem tất cả (${totalCount})` : "Xem danh sách"}{" "}
            <BookingIcon name="arrowRight" size={14} />
          </span>
        </button>
      </section>

      {/* 3. Upcoming Appointment / Status */}
      <section className="ph-section">
        <div className="ph-section__head">
          <h2 className="ph-section__title">Lịch khám sắp tới</h2>
          {totalCount > 0 && (
            <button
              type="button"
              className="ph-section__link"
              onClick={() => navigate(BOOKING_PATHS.appointments)}
            >
              Xem tất cả lịch hẹn →
            </button>
          )}
        </div>

        {loading && (
          <div className="ph-state-box" role="status">
            <span className="ph-spinner" aria-hidden="true" />
            <span>Đang tải thông tin lịch khám...</span>
          </div>
        )}

        {!loading && error && (
          <div className="ph-state-box ph-state-box--error" role="alert">
            <span>Không thể tải thông tin lịch hẹn: {error.message}</span>
            <button type="button" className="ph-btn-retry" onClick={reload}>
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && activeAppointment && (
          <div className="ph-upcoming-card">
            <div className="ph-upcoming-card__top">
              <span
                className={`ph-badge ph-badge--${getStatusKey(activeAppointment)}`}
              >
                {getStatusLabel(activeAppointment)}
              </span>
              <span className="ph-upcoming-card__code">
                Mã: {activeAppointment.ma_dat_lich}
              </span>
            </div>

            <div className="ph-upcoming-card__body">
              <div className="ph-upcoming-card__time">
                <BookingIcon name="clock" size={18} />
                <span>{formatDateTime(activeAppointment)}</span>
              </div>

              <div className="ph-upcoming-card__doctor-wrap">
                <span className="ph-avatar">
                  {getInitials(activeAppointment.bac_si_ten)}
                </span>
                <div className="ph-upcoming-card__doctor-info">
                  <span className="ph-upcoming-card__doctor-name">
                    BS. {activeAppointment.bac_si_ten || "Chưa phân công"}
                  </span>
                  <span className="ph-upcoming-card__specialty">
                    {activeAppointment.ten_chuyen_khoa || "Chuyên khoa khám"}
                  </span>
                </div>
              </div>

              <div className="ph-upcoming-card__meta">
                <span className="ph-upcoming-card__meta-item">
                  <BookingIcon name="building" size={15} />
                  Phòng:{" "}
                  <strong className="ph-upcoming-card__room-tag">
                    {activeAppointment.ten_phong || "Chưa cập nhật"}
                  </strong>
                </span>
              </div>
            </div>

            <div className="ph-upcoming-card__footer">
              <p className="ph-upcoming-card__hint">
                <BookingIcon name="qr" size={14} />
                Xuất trình mã QR tại quầy tiếp đón khi đến viện
              </p>
              <button
                type="button"
                className="ph-btn-view"
                onClick={() =>
                  navigate(BOOKING_PATHS.appointmentDetail(activeAppointment.id))
                }
              >
                Xem chi tiết &amp; mã QR <BookingIcon name="arrowRight" size={13} />
              </button>
            </div>
          </div>
        )}

        {!loading && !error && !activeAppointment && totalCount > 0 && (
          <div className="ph-empty-box">
            <div className="ph-empty-box__icon" aria-hidden="true">
              <BookingIcon name="checkCircle" size={24} />
            </div>
            <div className="ph-empty-box__text">
              <h3 className="ph-empty-box__title">
                Bạn không có lịch khám sắp tới
              </h3>
              <p className="ph-empty-box__sub">
                Tất cả lịch khám trước đây đã hoàn tất hoặc đã hủy. Bạn có thể đặt
                lịch mới bất cứ lúc nào.
              </p>
            </div>
            <button
              type="button"
              className="ph-btn-primary"
              onClick={() => navigate(BOOKING_PATHS.specialty)}
            >
              <BookingIcon name="calendar" size={16} />
              Đặt lịch khám mới
            </button>
          </div>
        )}

        {!loading && !error && totalCount === 0 && (
          <div className="ph-empty-box">
            <div className="ph-empty-box__icon" aria-hidden="true">
              <BookingIcon name="calendar" size={24} />
            </div>
            <div className="ph-empty-box__text">
              <h3 className="ph-empty-box__title">Chưa có lịch khám nào</h3>
              <p className="ph-empty-box__sub">
                Đăng ký khám trực tuyến để chủ động chọn bác sĩ, khung giờ và nhận
                mã QR tiếp đón nhanh tại viện.
              </p>
            </div>
            <button
              type="button"
              className="ph-btn-primary"
              onClick={() => navigate(BOOKING_PATHS.specialty)}
            >
              <BookingIcon name="calendar" size={16} />
              Đặt lịch khám ngay
            </button>
          </div>
        )}
      </section>

      {/* 4. Support & Guidance Notice */}
      <aside className="ph-support" aria-label="Thông tin hỗ trợ">
        <span className="ph-support__icon" aria-hidden="true">
          <BookingIcon name="info" size={20} />
        </span>
        <div className="ph-support__body">
          <strong>Hướng dẫn tiếp đón tại bệnh viện</strong>
          <span>
            Vui lòng đến trước giờ khám ít nhất 10 phút và xuất trình mã QR lịch hẹn
            tại quầy tiếp đón Lễ tân.
          </span>
        </div>
      </aside>
    </div>
  );
}

export default PatientHomePage;
