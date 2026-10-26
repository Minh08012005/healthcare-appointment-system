import { useNavigate } from "react-router-dom";
import BookingHeader from "./BookingHeader";
import { BOOKING_PATHS } from "./bookingPaths";
import { useBooking } from "../../../booking/useBooking";
import { useFetch } from "../../../api/useFetch";
import "./booking.css";

function SelectSpecialtyPage() {
  const navigate = useNavigate();
  const { selection, selectSpecialty } = useBooking();
  const { data, loading, error, reload } = useFetch("/api/master/chuyen-khoa");

  const handleSelect = (item) => {
    selectSpecialty({ id: item.id, ten_chuyen_khoa: item.ten_chuyen_khoa });
    navigate(BOOKING_PATHS.doctor);
  };

  return (
    <div className="booking">
      <BookingHeader
        title="Chọn chuyên khoa"
        step={1}
        label="Chuyên khoa"
        onBack={() => navigate(BOOKING_PATHS.home)}
      />

      <main className="booking__main">
        <div className="booking__card booking__card--row">
          <span className="booking__icon">🏥</span>
          <div>
            <strong>Khám theo chuyên khoa</strong>
            <p className="booking__sub">Đặt lịch trực tiếp với bác sĩ chuyên khoa đầu ngành</p>
          </div>
        </div>

        <div className="booking__section">
          <h2 className="booking__section-title">Chuyên khoa phổ biến</h2>
          {data && <span className="booking__section-count">{data.length} chuyên khoa</span>}
        </div>

        {loading && <p className="booking__message">Đang tải danh sách chuyên khoa...</p>}

        {error && (
          <div className="booking__message booking__message--error">
            <p>{error.message}</p>
            <button type="button" className="booking__btn booking__btn--outline" onClick={reload}>
              Thử lại
            </button>
          </div>
        )}

        {data && data.length === 0 && (
          <p className="booking__message">Hiện chưa có chuyên khoa.</p>
        )}

        {data &&
          data.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`booking__item ${
                selection.specialty?.id === item.id ? "booking__item--active" : ""
              }`}
              onClick={() => handleSelect(item)}
            >
              <span className="booking__item-body">{item.ten_chuyen_khoa}</span>
              <span>›</span>
            </button>
          ))}
      </main>
    </div>
  );
}

export default SelectSpecialtyPage;