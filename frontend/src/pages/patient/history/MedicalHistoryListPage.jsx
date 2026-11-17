import { useNavigate } from "react-router-dom";
import BookingIcon from "../booking/BookingIcons";
import { BOOKING_PATHS } from "../booking/bookingPaths";
import { getInitials } from "../booking/bookingFormat";
import { historyApi } from "../../../api/patientHistory";
import { useFetch } from "../../../api/useFetch";
import { EmptyState, ErrorState, LoadingState } from "../appointments/StateMessage";
import { formatShortDate } from "../appointments/appointmentHelpers";
import { HISTORY_PATHS } from "./historyPaths";
import "../booking/booking.css";
import "../appointments/appointments.css";
import "./history.css";

// C6-11 — Lịch sử khám bệnh (UC-037): danh sách các lần khám ĐÃ HOÀN TẤT của chính bệnh nhân.
// Backend đã lọc đúng chủ hồ sơ + DA_XONG và sắp xếp mới nhất trước.
function MedicalHistoryListPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch(historyApi.listPath());
  const list = Array.isArray(data) ? data : [];

  return (
    <div className="ap-page">
      <header className="ap-page-header">
        <div className="ap-page-header__main">
          <span className="ap-kicker">HỒ SƠ BỆNH ÁN</span>
          <h1 className="ap-page-title">Lịch sử khám bệnh</h1>
          <p className="ap-page-desc">
            Xem lại kết quả khám, chẩn đoán, đơn thuốc và chỉ định xét nghiệm các đợt khám đã hoàn tất.
          </p>
        </div>
        <button
          type="button"
          className="ap-btn ap-btn--primary"
          onClick={() => navigate(BOOKING_PATHS.specialty)}
        >
          <BookingIcon name="calendar" size={16} />
          <span>Đặt lịch khám mới</span>
        </button>
      </header>

      <main className="ap-main">
        {loading && <LoadingState text="Đang tải lịch sử khám bệnh của bạn..." />}

        {!loading && error && (
          <ErrorState
            error={error}
            onRetry={reload}
            onBack={() => navigate(BOOKING_PATHS.home)}
            backLabel="Về trang chủ"
          />
        )}

        {!loading && !error && list.length === 0 && (
          <EmptyState
            icon="medical"
            title="Chưa có lịch sử khám bệnh"
            description="Sau khi bác sĩ hoàn tất một lần khám tại bệnh viện, kết quả chẩn đoán và đơn thuốc sẽ được lưu trữ an toàn tại đây để bạn tiện theo dõi."
            actionText="Đặt lịch khám ngay"
            onAction={() => navigate(BOOKING_PATHS.specialty)}
          />
        )}

        {!loading && !error && list.length > 0 && (
          <>
            <div className="mh-header-card">
              <div className="mh-count">
                Tổng cộng <strong>{list.length}</strong> lần khám đã hoàn tất
              </div>
              <span className="mh-sort-badge">
                <BookingIcon name="clock" size={13} />
                <span>Mới nhất trước</span>
              </span>
            </div>

            <ul className="ap-list">
              {list.map((r) => (
                <li key={r.ho_so_id}>
                  <button
                    type="button"
                    className="ap-item mh-card-item"
                    onClick={() => navigate(HISTORY_PATHS.detail(r.ho_so_id))}
                  >
                    <div className="ap-item__top">
                      <strong className="ap-item__time">
                        <BookingIcon name="calendar" size={16} />
                        Ngày khám: {formatShortDate(r.ngay_kham)}
                      </strong>
                      <span className="mh-tag-completed">
                        <BookingIcon name="check" size={12} />
                        <span>Hồ sơ đã hoàn tất</span>
                      </span>
                    </div>

                    <div className="ap-item__doctor">
                      <span className="ap-avatar">{getInitials(r.doctor?.ho_ten)}</span>
                      <div className="ap-item__info">
                        <span className="ap-item__specialty">
                          {r.chuyen_khoa?.ten_chuyen_khoa || "Chuyên khoa khám"}
                        </span>
                        <strong className="ap-item__name">
                          {r.doctor?.cap_bac ? `${r.doctor.cap_bac} ` : "BS. "}
                          {r.doctor?.ho_ten || "—"}
                        </strong>
                      </div>
                      <span className="ap-chevron" aria-hidden="true">
                        <BookingIcon name="arrowRight" size={16} />
                      </span>
                    </div>

                    <div className="ap-item__meta mh-item__meta">
                      <span className="mh-lab-counter">
                        <BookingIcon name="medical" size={13} />
                        {r.so_xet_nghiem > 0 ? (
                          <strong>{r.so_xet_nghiem} xét nghiệm cận lâm sàng</strong>
                        ) : (
                          "Không có chỉ định xét nghiệm"
                        )}
                      </span>
                      <span className="mh-cta">Xem chi tiết bệnh án →</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

export default MedicalHistoryListPage;
