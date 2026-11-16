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
import heroImg from "../../assets/hero.png";
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
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          1. HERO — MAIN VISUAL MOMENT + EMBEDDED APPOINTMENT PANEL
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="ph-hero" aria-label="Giới thiệu và thao tác chính">
        <div className="ph-hero__container">
          {/* Main 2-column Hero content */}
          <div className="ph-hero__main">
            <div className="ph-hero__text">
              <div className="ph-hero__meta">
                <span className="ph-kicker">
                  <span className="ph-kicker__bar" aria-hidden="true" />
                  CỔNG TIẾP ĐÓN BỆNH NHÂN
                </span>
                <span className="ph-hero__user-tag">Xin chào, {displayName}</span>
              </div>

              <h1 className="ph-hero__headline">
                Chăm sóc sức khỏe<br />
                thuận tiện hơn mỗi ngày
              </h1>
              <p className="ph-hero__copy">
                Đặt lịch khám với bác sĩ chuyên khoa, tra cứu thông tin và nhận mã tiếp đón QR trực tuyến trước khi đến bệnh viện.
              </p>
              <div className="ph-hero__ctas">
                <button
                  type="button"
                  className="ph-cta-primary"
                  onClick={() => navigate(BOOKING_PATHS.specialty)}
                >
                  <BookingIcon name="calendar" size={17} />
                  Đặt lịch khám
                </button>
                <button
                  type="button"
                  className="ph-cta-secondary"
                  onClick={() => navigate(BOOKING_PATHS.appointments)}
                >
                  Xem lịch hẹn
                  {totalCount > 0 && (
                    <span className="ph-cta-secondary__badge">{totalCount}</span>
                  )}
                </button>
              </div>
            </div>

            <div className="ph-hero__visual" aria-hidden="true">
              <img
                src={heroImg}
                alt=""
                className="ph-hero__img"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>

          {/* Embedded Appointment Strip / Dock */}
          <div className="ph-appointment-dock" aria-label="Trạng thái lịch khám gần nhất">
            {loading && (
              <div className="ph-dock-status" role="status">
                <span className="ph-spinner" aria-hidden="true" />
                <span>Đang kiểm tra lịch khám sắp tới...</span>
              </div>
            )}

            {!loading && error && (
              <div className="ph-dock-status ph-dock-status--error" role="alert">
                <div className="ph-dock-status__msg">
                  <BookingIcon name="info" size={18} />
                  <span>Không thể tải lịch hẹn: {error.message}</span>
                </div>
                <button type="button" className="ph-btn-retry" onClick={reload}>
                  Thử lại
                </button>
              </div>
            )}

            {!loading && !error && activeAppointment && (
              <div className="ph-dock-card">
                <div className="ph-dock-card__header">
                  <div className="ph-dock-card__header-left">
                    <span className="ph-dock-card__title-tag">LỊCH KHÁM SẮP TỚI</span>
                    <span className={`ph-badge ph-badge--${getStatusKey(activeAppointment)}`}>
                      {getStatusLabel(activeAppointment)}
                    </span>
                  </div>
                  <span className="ph-dock-card__code">
                    Mã: <strong>{activeAppointment.ma_dat_lich}</strong>
                  </span>
                </div>

                <div className="ph-dock-card__content">
                  <div className="ph-dock-card__time">
                    <BookingIcon name="clock" size={16} />
                    <strong>{formatDateTime(activeAppointment)}</strong>
                  </div>

                  <div className="ph-dock-card__doctor">
                    <span className="ph-avatar-sm" aria-hidden="true">
                      {getInitials(activeAppointment.bac_si_ten)}
                    </span>
                    <div className="ph-dock-card__doctor-text">
                      <span className="ph-dock-card__name">
                        BS. {activeAppointment.bac_si_ten || "Chưa phân công"}
                      </span>
                      <span className="ph-dock-card__spec">
                        {activeAppointment.ten_chuyen_khoa || "Chuyên khoa khám"}
                      </span>
                    </div>
                  </div>

                  {activeAppointment.ten_phong && (
                    <div className="ph-dock-card__room">
                      <BookingIcon name="building" size={14} />
                      <span>Phòng: <strong>{activeAppointment.ten_phong}</strong></span>
                    </div>
                  )}

                  <div className="ph-dock-card__action">
                    <button
                      type="button"
                      className="ph-btn-view"
                      onClick={() =>
                        navigate(BOOKING_PATHS.appointmentDetail(activeAppointment.id))
                      }
                    >
                      Xem chi tiết &amp; mã QR
                      <BookingIcon name="arrowRight" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && !activeAppointment && totalCount > 0 && (
              <div className="ph-dock-strip">
                <div className="ph-dock-strip__left">
                  <span className="ph-dock-strip__icon" aria-hidden="true">
                    <BookingIcon name="checkCircle" size={18} />
                  </span>
                  <div>
                    <strong>Bạn không có lịch khám sắp tới</strong>
                    <span className="ph-dock-strip__sub">
                      Tất cả lịch khám trước đây đã hoàn tất hoặc đã hủy.
                    </span>
                  </div>
                </div>
                <div className="ph-dock-strip__actions">
                  <button
                    type="button"
                    className="ph-dock-link"
                    onClick={() => navigate(BOOKING_PATHS.appointments)}
                  >
                    Xem lịch hẹn cũ ({totalCount}) →
                  </button>
                  <button
                    type="button"
                    className="ph-cta-primary ph-cta-primary--sm"
                    onClick={() => navigate(BOOKING_PATHS.specialty)}
                  >
                    <BookingIcon name="calendar" size={14} />
                    Đặt lịch mới
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && totalCount === 0 && (
              <div className="ph-dock-strip">
                <div className="ph-dock-strip__left">
                  <span className="ph-dock-strip__icon" aria-hidden="true">
                    <BookingIcon name="calendar" size={18} />
                  </span>
                  <div>
                    <strong>Chưa có lịch khám nào được đăng ký</strong>
                    <span className="ph-dock-strip__sub">
                      Đăng ký trực tuyến để chọn bác sĩ, khung giờ và nhận mã QR check-in nhanh tại bệnh viện.
                    </span>
                  </div>
                </div>
                <div className="ph-dock-strip__actions">
                  <button
                    type="button"
                    className="ph-cta-primary ph-cta-primary--sm"
                    onClick={() => navigate(BOOKING_PATHS.specialty)}
                  >
                    <BookingIcon name="calendar" size={14} />
                    Đặt lịch khám ngay
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          2. STRONG CONTRAST SECTION — BOOKING JOURNEY (DEEP NAVY)
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="ph-dark-section" aria-label="Quy trình đặt lịch khám">
        <div className="ph-dark-section__container">
          <div className="ph-dark-section__header">
            <span className="ph-kicker ph-kicker--dark">
              <span className="ph-kicker__bar ph-kicker__bar--accent" aria-hidden="true" />
              QUY TRÌNH TIẾP ĐÓN
            </span>
            <h2 className="ph-dark-section__title">5 bước đặt lịch khám tại MEDICARE</h2>
            <p className="ph-dark-section__sub">
              Quy trình chuẩn hóa giúp bạn chủ động thời gian, giảm thiểu thời gian chờ đợi tại quầy tiếp đón.
            </p>
          </div>

          <ol className="ph-steps-flow" aria-label="Danh sách các bước">
            {[
              {
                num: "01",
                label: "Chọn chuyên khoa",
                desc: "Tra cứu đúng chuyên khoa theo nhu cầu khám",
              },
              {
                num: "02",
                label: "Chọn bác sĩ",
                desc: "Xem thông tin bác sĩ chuyên môn và lịch làm việc",
              },
              {
                num: "03",
                label: "Chọn ngày và giờ",
                desc: "Lựa chọn khung giờ khám bệnh thuận tiện nhất",
              },
              {
                num: "04",
                label: "Xác nhận thông tin",
                desc: "Kiểm tra kỹ thông tin bệnh nhân và chế độ BHYT",
              },
              {
                num: "05",
                label: "Nhận mã QR",
                desc: "Lưu mã QR tiếp đón để check-in tại quầy lễ tân",
              },
            ].map((step, idx) => (
              <li key={step.num} className="ph-step-item">
                <div className="ph-step-item__top">
                  <span className={`ph-step-item__num${idx === 0 ? " ph-step-item__num--active" : ""}`}>
                    {step.num}
                  </span>
                  {idx < 4 && <span className="ph-step-item__connector" aria-hidden="true" />}
                </div>
                <div className="ph-step-item__body">
                  <h3 className="ph-step-item__title">{step.label}</h3>
                  <p className="ph-step-item__desc">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="ph-dark-section__cta">
            <button
              type="button"
              className="ph-cta-primary"
              onClick={() => navigate(BOOKING_PATHS.specialty)}
            >
              <BookingIcon name="calendar" size={16} />
              Bắt đầu đặt lịch ngay
            </button>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          3. PREPARE FOR VISIT — CRISP, LIGHT, MINIMALIST
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="ph-prepare-section" aria-label="Chuẩn bị trước khi đến khám">
        <div className="ph-prepare-section__container">
          <div className="ph-prepare-section__header">
            <span className="ph-kicker">
              <span className="ph-kicker__bar" aria-hidden="true" />
              HƯỚNG DẪN ĐẾN KHÁM
            </span>
            <h2 className="ph-prepare-section__title">Chuẩn bị trước khi đến khám</h2>
            <p className="ph-prepare-section__sub">
              Những điều cần lưu ý để quá trình tiếp đón và khám bệnh diễn ra nhanh chóng, chính xác
            </p>
          </div>

          <div className="ph-prep-grid">
            <div className="ph-prep-col">
              <div className="ph-prep-col__icon" aria-hidden="true">
                <BookingIcon name="qr" size={19} />
              </div>
              <div className="ph-prep-col__body">
                <h3 className="ph-prep-col__title">Mã QR lịch hẹn</h3>
                <p className="ph-prep-col__text">
                  Xuất trình mã QR trên điện thoại hoặc bản in tại quầy tiếp đón Lễ tân để nhận số thứ tự phòng khám ngay lập tức.
                </p>
              </div>
            </div>

            <div className="ph-prep-col">
              <div className="ph-prep-col__icon" aria-hidden="true">
                <BookingIcon name="cardOff" size={19} />
              </div>
              <div className="ph-prep-col__body">
                <h3 className="ph-prep-col__title">Giấy tờ tùy thân &amp; BHYT</h3>
                <p className="ph-prep-col__text">
                  Mang theo CCCD gắn chip và thẻ BHYT (hoặc ứng dụng VssID / VNeID) nếu áp dụng chế độ bảo hiểm y tế.
                </p>
              </div>
            </div>

            <div className="ph-prep-col">
              <div className="ph-prep-col__icon" aria-hidden="true">
                <BookingIcon name="clock" size={19} />
              </div>
              <div className="ph-prep-col__body">
                <h3 className="ph-prep-col__title">Có mặt đúng khung giờ</h3>
                <p className="ph-prep-col__text">
                  Vui lòng đến trước giờ hẹn 10–15 phút để hoàn tất thủ tục kiểm tra thông tin hành chính và đo sinh hiệu ban đầu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PatientHomePage;
