import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import BookingHeader from "./BookingHeader";
import BookingIcon from "./BookingIcons";
import { BOOKING_PATHS } from "./bookingPaths";
import { formatDate, formatTime } from "./bookingFormat";
import { useBooking } from "../../../booking/useBooking";
import "./booking.css";

const MAX_SYMPTOM = 500; // theo Figma BN11 (backend cho tối đa 1000)

const BHYT_OPTIONS = [
  { value: true, title: "Có dùng", desc: "Giảm chi phí khám", icon: "shield" },
  { value: false, title: "Không dùng", desc: "Khám dịch vụ tự túc", icon: "cardOff" },
];

// BN11 — Nhập thông tin khám
function PatientInfoPage() {
  const navigate = useNavigate();
  const { selection, info, updateInfo } = useBooking();
  const { specialty, doctor, date, slot } = selection;
  const [errors, setErrors] = useState({});

  // Thiếu selection (F5 / vào thẳng URL) -> quay về bước còn thiếu
  if (!slot || !doctor || !date) {
    return <Navigate to={doctor ? BOOKING_PATHS.slot : BOOKING_PATHS.specialty} replace />;
  }

  const handleNext = () => {
    const nextErrors = {};
    if (info.su_dung_bhyt === null) nextErrors.bhyt = "Vui lòng chọn có hoặc không dùng BHYT.";
    if (!info.trieu_chung.trim()) nextErrors.trieuChung = "Vui lòng nhập lý do khám / triệu chứng.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) navigate(BOOKING_PATHS.confirm);
  };

  return (
    <div className="booking booking--with-footer">
      <BookingHeader
        title="Thông tin khám"
        step={4}
        label="Thông tin khám"
        onBack={() => navigate(BOOKING_PATHS.slot)}
      />

      <main className="booking__main">
        <div className="bk-card bk-summary">
          <span className="bk-icon-box">
            <BookingIcon name="calendar" size={22} />
          </span>
          <div>
            <span className="bk-pill">{specialty?.ten_chuyen_khoa ?? doctor.ten_chuyen_khoa}</span>
            <div className="bk-doctor-name">BS. {doctor.ho_ten}</div>
            <div className="bk-meta">
              <BookingIcon name="clock" size={13} />
              {formatTime(slot.gio_bat_dau)}, {formatDate(date)}
            </div>
          </div>
        </div>

        <label className="bk-label">Phòng khám</label>
        <div className="bk-readonly">
          <BookingIcon name="building" size={18} />
          <strong>{slot.ten_phong ?? "Chưa có phòng"}</strong>
          <BookingIcon name="lock" size={16} className="bk-muted" />
        </div>
        <p className="bk-hint">
          <BookingIcon name="info" size={12} />
          Hệ thống tự gán theo khung giờ
        </p>

        <label className="bk-label">
          Sử dụng BHYT <span className="bk-required">*</span>
        </label>
        <div className="bk-choices">
          {BHYT_OPTIONS.map((opt) => {
            const active = info.su_dung_bhyt === opt.value;
            return (
              <button
                key={opt.title}
                type="button"
                className={`bk-choice ${active ? "bk-choice--active" : ""}`}
                onClick={() => {
                  updateInfo({ su_dung_bhyt: opt.value });
                  setErrors((prev) => ({ ...prev, bhyt: undefined }));
                }}
              >
                <span className="bk-choice-top">
                  <BookingIcon name={opt.icon} size={18} />
                  <span className={`bk-radio ${active ? "bk-radio--on" : ""}`}>
                    {active && <BookingIcon name="check" size={12} />}
                  </span>
                </span>
                <strong>{opt.title}</strong>
                <small>{opt.desc}</small>
              </button>
            );
          })}
        </div>
        {errors.bhyt && <p className="bk-error">{errors.bhyt}</p>}

        <label className="bk-label" htmlFor="trieu_chung">
          Lý do khám / Triệu chứng <span className="bk-required">*</span>
        </label>
        <div className="bk-textarea-box">
          <textarea
            id="trieu_chung"
            className="bk-textarea"
            rows={4}
            maxLength={MAX_SYMPTOM}
            placeholder="Mô tả ngắn gọn triệu chứng của bạn (ví dụ: đau đầu, sốt nhẹ 2 ngày nay...)"
            value={info.trieu_chung}
            onChange={(e) => {
              updateInfo({ trieu_chung: e.target.value });
              setErrors((prev) => ({ ...prev, trieuChung: undefined }));
            }}
          />
          <div className="bk-textarea-footer">
            <span className="bk-tip">
              <BookingIcon name="lightbulb" size={12} />
              Chi tiết giúp BS chuẩn bị tốt hơn
            </span>
            <span>
              {info.trieu_chung.length}/{MAX_SYMPTOM}
            </span>
          </div>
        </div>
        {errors.trieuChung && <p className="bk-error">{errors.trieuChung}</p>}

        <div className="bk-card bk-privacy">
          <BookingIcon name="shieldCheck" size={18} />
          <p>
            Thông tin y tế của bạn được mã hóa an toàn và chỉ cung cấp cho bác sĩ điều trị theo
            Luật Khám chữa bệnh.
          </p>
        </div>
      </main>

      <div className="bk-footer">
        <button type="button" className="bk-btn bk-btn--primary" onClick={handleNext}>
          Tiếp theo <BookingIcon name="arrowRight" size={16} />
        </button>
      </div>
    </div>
  );
}

export default PatientInfoPage;