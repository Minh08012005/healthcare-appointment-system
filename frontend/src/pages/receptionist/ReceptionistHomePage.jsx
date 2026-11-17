import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import "./receptionHome.css";

const RECEPTION_SHORTCUTS = [
  {
    path: "/receptionist/check-in-online",
    label: "Check-in Online",
    tag: "Luồng A · Đặt khám online",
    tagType: "online",
    description:
      "Tiếp nhận bệnh nhân đã đặt lịch trước qua cổng trực tuyến. Quét mã QR trên phiếu khám hoặc nhập mã đặt lịch để xác nhận và cấp STT vào phòng khám.",
    features: [
      "Quét mã QR phiếu khám hoặc nhập mã đặt lịch",
      "Tự động đối soát khung giờ check-in hợp lệ",
      "Đưa bệnh nhân vào hàng đợi khám ưu tiên",
    ],
    actionText: "Vào Check-in Online",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="rec-card__icon-svg"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <circle cx="6.5" cy="6.5" r="1" fill="currentColor" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
        <circle cx="6.5" cy="17.5" r="1" fill="currentColor" />
        <path d="M14 17h3m-1.5-1.5v3" />
      </svg>
    ),
  },
  {
    path: "/receptionist/walk-in",
    label: "Tiếp đón & Đăng ký Offline",
    tag: "Luồng B · Trực tiếp tại quầy",
    tagType: "offline",
    description:
      "Tiếp nhận bệnh nhân vãng lai hoặc đăng ký khám trực tiếp tại quầy. Đọc tự động thông tin từ QR CCCD gắn chip hoặc lập hồ sơ thủ công nhanh chóng.",
    features: [
      "Quét mã QR thẻ CCCD gắn chip tự động điền hồ sơ",
      "Hỗ trợ nhập thông tin thẻ BHYT & ghi nhận triệu chứng",
      "Chọn chuyên khoa, phòng khám & cấp ngay phiếu STT",
    ],
    actionText: "Vào Tiếp đón Offline",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="rec-card__icon-svg"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2.5" />
        <path d="M15 8h3m-3 4h3m-3 4h3" />
        <path d="M5.5 17c.5-1.8 2-2.5 3.5-2.5s3 .7 3.5 2.5" />
      </svg>
    ),
  },
  {
    path: "/receptionist/queue",
    label: "Hàng đợi & Điều phối",
    tag: "Điều phối phòng khám",
    tagType: "queue",
    description:
      "Theo dõi danh sách bệnh nhân đang chờ khám tại từng phòng khám, trạng thái gọi khám theo thời gian thực và xử lý xếp lại hàng cho bệnh nhân bị bỏ lượt.",
    features: [
      "Theo dõi danh sách chờ trực tiếp theo từng phòng",
      "Giám sát trạng thái Chờ khám / Đang gọi / Đang khám",
      "Thao tác xếp lại hàng (Requeue) khi bệnh nhân bị nhỡ lượt",
    ],
    actionText: "Mở Hàng đợi khám",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="rec-card__icon-svg"
        aria-hidden="true"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

function ReceptionistHomePage() {
  const { user } = useAuth();
  const displayName = user?.ho_ten || user?.username || "Nhân viên Lễ tân";

  const todayFormatted = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

  return (
    <div className="rec-dashboard">
      <header className="rec-header">
        <div className="rec-header__top">
          <span className="rec-header__badge">Bàn tiếp đón &amp; Điều phối</span>
          <span className="rec-header__date">📅 {todayFormatted}</span>
        </div>
        <h1 className="rec-header__title">Chào mừng, {displayName}</h1>
        <p className="rec-header__desc">
          Hệ thống Quản lý Bệnh viện MEDICARE — Chọn nghiệp vụ tiếp nhận hoặc điều phối bệnh nhân bên dưới để bắt đầu làm việc trong ca trực.
        </p>
      </header>

      <section>
        <h2 className="rec-section__title">Nghiệp vụ tiếp đón chính</h2>
        <div className="rec-grid">
          {RECEPTION_SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.path}
              to={shortcut.path}
              className={`rec-card rec-card--${shortcut.tagType}`}
            >
              <div>
                <div className="rec-card__head">
                  <div className="rec-card__icon-wrap">{shortcut.icon}</div>
                  <span
                    className={`rec-card__tag rec-card__tag--${shortcut.tagType}`}
                  >
                    {shortcut.tag}
                  </span>
                </div>
                <h3 className="rec-card__title">{shortcut.label}</h3>
                <p className="rec-card__desc">{shortcut.description}</p>
                <ul className="rec-card__features">
                  {shortcut.features.map((feature, idx) => (
                    <li key={idx} className="rec-card__feature-item">
                      <span className="rec-card__feature-bullet" aria-hidden="true">
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <span className="rec-card__action">
                {shortcut.actionText} <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rec-guide">
        <h2 className="rec-guide__title">Quy trình tiếp đón bệnh nhân tiêu chuẩn</h2>
        <div className="rec-guide__steps">
          <div className="rec-guide__step">
            <span className="rec-guide__step-num">1</span>
            <div className="rec-guide__step-content">
              <strong>Phân loại luồng tiếp nhận</strong>
              <p>
                Hỏi bệnh nhân đã có mã đặt lịch online trước hay đến khám trực tiếp để chọn luồng Check-in phù hợp.
              </p>
            </div>
          </div>
          <div className="rec-guide__step">
            <span className="rec-guide__step-num">2</span>
            <div className="rec-guide__step-content">
              <strong>Xác thực &amp; Cấp số thứ tự</strong>
              <p>
                Quét mã QR lịch hẹn hoặc CCCD gắn chip. Hệ thống tự động xác nhận và cấp số thứ tự vào phòng khám chuyên khoa.
              </p>
            </div>
          </div>
          <div className="rec-guide__step">
            <span className="rec-guide__step-num">3</span>
            <div className="rec-guide__step-content">
              <strong>Hướng dẫn &amp; Điều phối</strong>
              <p>
                Hướng dẫn bệnh nhân đến phòng khám tương ứng; theo dõi màn hình Hàng đợi để hỗ trợ khi bệnh nhân bị nhỡ lượt.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ReceptionistHomePage;
