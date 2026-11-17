import { useNavigate } from "react-router-dom";
import BookingIcon from "../booking/BookingIcons";
import { BOOKING_PATHS } from "../booking/bookingPaths";
import { getInitials } from "../booking/bookingFormat";
import { historyApi } from "../../../api/patientHistory";
import { useFetch } from "../../../api/useFetch";
import { ErrorState, LoadingState } from "../appointments/StateMessage";
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
      <header className="ap-header">
        <div className="ap-header__main">
          <h1>Lịch sử khám bệnh</h1>
          <p className="ap-header__sub">Các lần khám đã hoàn tất của bạn</p>
        </div>
      </header>

      <main className="ap-main">
        {loading && <LoadingState text="Đang tải lịch sử khám..." />}

        {!loading && error && (
          <ErrorState
            error={error}
            onRetry={reload}
            onBack={() => navigate(BOOKING_PATHS.home)}
            backLabel="Về trang chủ"
          />
        )}

        {!loading && !error && list.length === 0 && (
          <div className="ap-state">
            <span className="ap-state__icon">
              <BookingIcon name="medical" size={28} />
            </span>
            <h3>Chưa có lịch sử khám bệnh</h3>
            <p>Sau khi bác sĩ hoàn tất một lần khám, kết quả sẽ được lưu tại đây để bạn xem lại.</p>
            <button
              type="button"
              className="ap-btn ap-btn--primary"
              onClick={() => navigate(BOOKING_PATHS.specialty)}
            >
              Đặt lịch khám
            </button>
          </div>
        )}

        {!loading && !error && list.length > 0 && (
          <>
            <div className="mh-count">
              <strong>{list.length}</strong> lần khám · mới nhất trước
            </div>
            <ul className="ap-list">
              {list.map((r) => (
                <li key={r.ho_so_id}>
                  <button
                    type="button"
                    className="ap-item"
                    onClick={() => navigate(HISTORY_PATHS.detail(r.ho_so_id))}
                  >
                    <div className="ap-item__top">
                      <strong className="ap-item__time">
                        <BookingIcon name="calendar" size={16} />
                        {formatShortDate(r.ngay_kham)}
                      </strong>
                      <span className="ap-badge ap-badge--completed">Đã hoàn tất</span>
                    </div>
                    <div className="ap-item__doctor">
                      <span className="ap-avatar">{getInitials(r.doctor?.ho_ten)}</span>
                      <div className="ap-item__info">
                        <strong>BS. {r.doctor?.ho_ten || "—"}</strong>
                        <span>{r.chuyen_khoa?.ten_chuyen_khoa || "Chưa cập nhật chuyên khoa"}</span>
                      </div>
                      <span className="ap-chevron">
                        <BookingIcon name="arrowRight" size={16} />
                      </span>
                    </div>
                    <div className="ap-item__meta">
                      <span>
                        {r.so_xet_nghiem > 0 ? `${r.so_xet_nghiem} xét nghiệm` : "Không có xét nghiệm"}
                      </span>
                      <span className="mh-cta">Xem chi tiết</span>
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
