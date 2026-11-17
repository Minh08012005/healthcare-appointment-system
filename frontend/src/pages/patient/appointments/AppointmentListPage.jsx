import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BookingIcon from "../booking/BookingIcons";
import { BOOKING_PATHS } from "../booking/bookingPaths";
import { getInitials, removeDiacritics } from "../booking/bookingFormat";
import { appointmentApi } from "../../../api/appointments";
import { useFetch } from "../../../api/useFetch";
import { EmptyState, ErrorState, LoadingState } from "./StateMessage";
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
    <div className="ap-page">
      <header className="ap-page-header">
        <div className="ap-page-header__main">
          <span className="ap-kicker">LỊCH KHÁM</span>
          <h1 className="ap-page-title">Lịch hẹn của tôi</h1>
          <p className="ap-page-desc">
            Theo dõi, quản lý và kiểm tra thông tin check-in các lượt khám tại MEDICARE.
          </p>
        </div>
        <button
          type="button"
          className="ap-btn ap-btn--primary"
          onClick={() => navigate(BOOKING_PATHS.specialty)}
        >
          <BookingIcon name="calendar" size={16} />
          <span>Đặt lịch mới</span>
        </button>
      </header>

      <main className="ap-main">
        {loading && <LoadingState text="Đang tải lịch hẹn của bạn..." />}

        {!loading && error && (
          <ErrorState
            error={error}
            onRetry={reload}
            onBack={() => navigate(BOOKING_PATHS.home)}
            backLabel="Về trang chủ"
          />
        )}

        {!loading && !error && (
          <>
            <div className="ap-filter-card">
              <div className="ap-title-row">
                <div className="ap-filter-title-group">
                  <h2 className="ap-filter-heading">Bộ lọc & tìm kiếm</h2>
                  <span className="ap-count">{total} tổng số</span>
                </div>
                <button
                  type="button"
                  className="ap-sort"
                  onClick={() => setNewestFirst((v) => !v)}
                  title="Thay đổi thứ tự hiển thị"
                >
                  <BookingIcon name="clock" size={13} />
                  <span>{newestFirst ? "Gần đây nhất" : "Cũ nhất trước"}</span>
                </button>
              </div>

              <div className="ap-search-wrap">
                <span className="ap-search-icon">
                  <BookingIcon name="search" size={16} />
                </span>
                <input
                  className="ap-search"
                  type="search"
                  placeholder="Tìm theo mã lịch hẹn (VD: AP...) hoặc tên bác sĩ..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  aria-label="Tìm lịch hẹn"
                />
              </div>

              <div className="ap-tabs-row">
                <div className="ap-tabs" role="tablist" aria-label="Lọc theo trạng thái">
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

                <div className="ap-result-count">
                  Hiển thị <strong>{visible.length}</strong> / {total} lượt khám
                </div>
              </div>
            </div>

            {total === 0 ? (
              <EmptyState
                icon="calendar"
                title="Bạn chưa có lịch hẹn nào"
                description="Đặt lịch khám trực tuyến để chủ động chọn bác sĩ, chuyên khoa và khung giờ phù hợp."
                actionText="Đặt lịch khám ngay"
                onAction={() => navigate(BOOKING_PATHS.specialty)}
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon="search"
                title="Không tìm thấy lịch hẹn phù hợp"
                description="Không có lịch hẹn nào khớp với bộ lọc hoặc từ khóa tìm kiếm hiện tại."
                actionText="Xóa bộ lọc tìm kiếm"
                onAction={() => {
                  setTab("all");
                  setKeyword("");
                }}
              />
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
                        <span className={`ap-badge ap-badge--${getStatusKey(a)}`}>
                          {getStatusLabel(a)}
                        </span>
                      </div>

                      <div className="ap-item__doctor">
                        <span className="ap-avatar">{getInitials(a.bac_si_ten)}</span>
                        <div className="ap-item__info">
                          <span className="ap-item__specialty">
                            {a.ten_chuyen_khoa || "Chuyên khoa khám"}
                          </span>
                          <strong className="ap-item__name">BS. {a.bac_si_ten || "—"}</strong>
                        </div>
                        <span className="ap-chevron" aria-hidden="true">
                          <BookingIcon name="arrowRight" size={16} />
                        </span>
                      </div>

                      <div className="ap-item__meta">
                        <span className="ap-item__location">
                          <BookingIcon name="building" size={13} />
                          {a.ten_phong || "Phòng khám chưa cập nhật"}
                        </span>
                        <span className="ap-item__code">Mã: {a.ma_dat_lich}</span>
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
              <div className="ap-help__content">
                <strong>Lưu ý khi đến khám tại bệnh viện</strong>
                <p>
                  Vui lòng có mặt trước giờ hẹn ít nhất 15 phút tại quầy tiếp đón và xuất trình mã QR
                  trong chi tiết lịch hẹn để hoàn tất thủ tục check-in nhanh chóng.
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
