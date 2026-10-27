import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BookingIcon from "../booking/BookingIcons";
import { BOOKING_PATHS } from "../booking/bookingPaths";
import { getInitials, removeDiacritics } from "../booking/bookingFormat";
import { appointmentApi } from "../../../api/appointments";
import { useFetch } from "../../../api/useFetch";
import { ErrorState, LoadingState } from "./StateMessage";
import { formatDateTime, getStatusKey, getStatusLabel } from "./appointmentHelpers";
import "../booking/booking.css";
import "./appointments.css";

const TABS = [
  { key: "all", label: "Tất cả" },
  { key: "booked", label: "Đã đặt" },
  { key: "cancelled", label: "Đã hủy" },
  { key: "expired", label: "Quá hạn check-in" },
];

// BN14 — Danh sách lịch đã đặt (API C2-08A: GET /api/appointments)
function AppointmentListPage() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch(appointmentApi.listPath());
  const [tab, setTab] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);

  const visible = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const q = removeDiacritics(keyword.trim());
    const filtered = list.filter((a) => {
      if (tab !== "all" && getStatusKey(a) !== tab) return false;
      if (!q) return true;
      return (
        removeDiacritics(a.ma_dat_lich).includes(q) || removeDiacritics(a.bac_si_ten).includes(q)
      );
    });
    // Backend trả mới nhất trước; đảo lại khi chọn "Cũ nhất"
    return newestFirst ? filtered : [...filtered].reverse();
  }, [data, tab, keyword, newestFirst]);

  const total = Array.isArray(data) ? data.length : 0;

  return (
    <div className="booking">
      <header className="ap-header">
        <h1>Lịch hẹn của tôi</h1>
        <button
          type="button"
          className="ap-btn ap-btn--primary ap-btn--sm"
          onClick={() => navigate(BOOKING_PATHS.specialty)}
        >
          <BookingIcon name="calendar" size={14} />
          Đặt lịch mới
        </button>
      </header>

      <main className="booking__main">
        {loading && <LoadingState text="Đang tải lịch hẹn..." />}

        {!loading && error && (
          <ErrorState error={error} onRetry={reload} onBack={() => navigate(BOOKING_PATHS.home)} backLabel="Về trang chủ" />
        )}

        {!loading && !error && (
          <>
            <div className="ap-title-row">
              <h2>Lịch khám của bạn</h2>
              <span className="ap-count">{total}</span>
            </div>

            <input
              className="ap-search"
              type="search"
              placeholder="Tìm theo mã lịch hẹn hoặc tên bác sĩ..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="Tìm lịch hẹn"
            />

            <div className="ap-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`ap-tab${tab === t.key ? " ap-tab--active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="ap-result-row">
              <span>
                Hiển thị <strong>{visible.length}</strong> kết quả
              </span>
              <button type="button" className="ap-sort" onClick={() => setNewestFirst((v) => !v)}>
                <BookingIcon name="clock" size={13} />
                {newestFirst ? "Gần đây nhất" : "Cũ nhất"}
              </button>
            </div>

            {total === 0 ? (
              <div className="ap-state">
                <span className="ap-state__icon">
                  <BookingIcon name="calendar" size={28} />
                </span>
                <h3>Bạn chưa có lịch hẹn nào</h3>
                <p>Đặt lịch khám để xem và quản lý lịch hẹn tại đây.</p>
                <button
                  type="button"
                  className="ap-btn ap-btn--primary"
                  onClick={() => navigate(BOOKING_PATHS.specialty)}
                >
                  Đặt lịch khám
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="ap-state">
                <h3>Không tìm thấy lịch hẹn phù hợp</h3>
                <p>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</p>
              </div>
            ) : (
              <ul className="ap-list">
                {visible.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="ap-item"
                      onClick={() => navigate(BOOKING_PATHS.appointmentDetail(a.id))}
                    >
                      <div className="ap-item__top">
                        <strong className="ap-item__time">
                          <BookingIcon name="calendar" size={16} />
                          {formatDateTime(a)}
                        </strong>
                        <span className={`ap-badge ap-badge--${getStatusKey(a)}`}>{getStatusLabel(a)}</span>
                      </div>
                      <div className="ap-item__doctor">
                        <span className="ap-avatar">{getInitials(a.bac_si_ten)}</span>
                        <div className="ap-item__info">
                          <strong>BS. {a.bac_si_ten || "—"}</strong>
                          <span>{a.ten_chuyen_khoa || "Chưa cập nhật chuyên khoa"}</span>
                        </div>
                        <span className="ap-chevron">
                          <BookingIcon name="arrowRight" size={16} />
                        </span>
                      </div>
                      <div className="ap-item__meta">
                        <span>
                          <BookingIcon name="building" size={13} />
                          {a.ten_phong || "Phòng chưa cập nhật"}
                        </span>
                        <span>{a.ma_dat_lich}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="ap-help">
              <span className="ap-help__icon">
                <BookingIcon name="info" size={20} />
              </span>
              <div>
                <strong>Cần trợ giúp kiểm tra lịch?</strong>
                <p>
                  Tổng đài viên MEDICARE sẵn sàng 24/7 qua <a href="tel:19006868">1900 6868</a>
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default AppointmentListPage;
