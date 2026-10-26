import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import BookingHeader from "./BookingHeader";
import { BOOKING_PATHS } from "./bookingPaths";
import { formatFee, formatMonthRange, getInitials } from "./bookingFormat";
import { useBooking } from "../../../booking/useBooking";
import { useFetch } from "../../../api/useFetch";
import "./booking.css";

const SHORT_WEEKDAYS = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];
const LONG_WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const pad = (n) => String(n).padStart(2, "0");

// Dải ngày để chọn (hôm nay + 6 ngày tới). Đây chỉ là các ngày, KHÔNG phải slot.
function buildDateOptions(count) {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return {
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      weekday: SHORT_WEEKDAYS[d.getDay()],
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    };
  });
}

// "2026-10-20" -> "Thứ Ba, 20/10/2026"
function formatDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return `${LONG_WEEKDAYS[d.getDay()]}, ${pad(day)}/${pad(month)}/${year}`;
}

function SelectSlotPage() {
  const navigate = useNavigate();
  const { selection, selectDate, selectSlot } = useBooking();
  const { specialty, doctor, date, slot } = selection;
  const [dateOptions] = useState(() => buildDateOptions(7));

  const path = doctor && date ? `/api/slots?bac_si_id=${doctor.id}&ngay=${date}` : null;
  const { data, loading, error, reload } = useFetch(path);

  // Chưa chọn bác sĩ (vào thẳng URL hoặc F5) -> quay về bước trước
  if (!doctor) {
    return <Navigate to={specialty ? BOOKING_PATHS.doctor : BOOKING_PATHS.specialty} replace />;
  }

  const slots = data?.trang_thai === "CON_SLOT" ? data.slots : [];
  const morning = slots.filter((s) => s.gio_bat_dau < "12:00");
  const afternoon = slots.filter((s) => s.gio_bat_dau >= "12:00");

  const renderGroup = (title, list) =>
    list.length > 0 && (
      <div>
        <h3 className="booking__group-title">{title}</h3>
        <div className="booking__slots">
          {list.map((s) => (
            <button
              key={s.lich_kham_id}
              type="button"
              title={`Còn ${s.slot_con_lai} chỗ`}
              className={`booking__slot ${
                slot?.lich_kham_id === s.lich_kham_id ? "booking__slot--active" : ""
              }`}
              onClick={() => selectSlot(s)}
            >
              {s.gio_bat_dau}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <div className="booking">
      <BookingHeader
        title="Chọn ngày và giờ khám"
        step={3}
        label="Ngày & giờ khám"
        onBack={() => navigate(BOOKING_PATHS.doctor)}
      />

      <main className="booking__main">
        <div className="booking__card booking__card--row">
          <span className="booking__avatar">{getInitials(doctor.ho_ten)}</span>
          <div>
            <small>Bác sĩ chỉ định</small>
            <div className="booking__item-name">BS. {doctor.ho_ten}</div>
            <span className="booking__badge">{doctor.ten_chuyen_khoa}</span>
            <div className="booking__fee">Phòng khám: {slot?.ten_phong ?? "—"}</div>
          </div>
        </div>

        <div className="booking__section">
          <h2 className="booking__section-title">{formatMonthRange(dateOptions)}</h2>
        </div>
        <div className="booking__days">
          {dateOptions.map((opt) => (
            <button
              key={opt.iso}
              type="button"
              className={`booking__day ${date === opt.iso ? "booking__day--active" : ""}`}
              onClick={() => selectDate(opt.iso)}
            >
              <small>{opt.weekday}</small>
              <strong>{opt.day}</strong>
            </button>
          ))}
        </div>

        <div className="booking__section">
          <h2 className="booking__section-title">Khung giờ còn trống</h2>
          {slots.length > 0 && (
            <span className="booking__section-count">{slots.length} khung giờ</span>
          )}
        </div>

        {!date && <p className="booking__message">Vui lòng chọn ngày khám.</p>}
        {loading && <p className="booking__message">Đang tải khung giờ...</p>}

        {error && (
          <div className="booking__message booking__message--error">
            <p>{error.message}</p>
            <button type="button" className="booking__btn booking__btn--outline" onClick={reload}>
              Thử lại
            </button>
          </div>
        )}

        {/* KHONG_CO_LICH hoặc DA_DAY: hiển thị message do Backend trả về */}
        {data && data.trang_thai !== "CON_SLOT" && (
          <p className="booking__message">{data.message}</p>
        )}

        {renderGroup("Buổi sáng", morning)}
        {renderGroup("Buổi chiều", afternoon)}

        <div className="booking__card">
          {slot && date ? (
            <div className="booking__summary">
              <span>Thời gian đã chọn:</span>
              <strong>
                {slot.gio_bat_dau} – {slot.gio_ket_thuc} • {formatDate(date)}
              </strong>
            </div>
          ) : (
            <p className="booking__sub">Chưa chọn khung giờ.</p>
          )}
          <div className="booking__summary">
            <span>Phí khám ban đầu</span>
            <strong>{formatFee(doctor.muc_phi)}</strong>
          </div>
          <button
            type="button"
            className="booking__btn booking__btn--primary"
            disabled={!slot}
            onClick={() => navigate(BOOKING_PATHS.patientInfo)}
          >
            Tiếp tục →
          </button>
        </div>
      </main>
    </div>
  );
}

export default SelectSlotPage;