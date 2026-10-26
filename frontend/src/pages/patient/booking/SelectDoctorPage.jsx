import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import BookingHeader from "./BookingHeader";
import { BOOKING_PATHS } from "./bookingPaths";
import { formatFee, getInitials, removeDiacritics } from "./bookingFormat";
import { useBooking } from "../../../booking/useBooking";
import { useFetch } from "../../../api/useFetch";
import "./booking.css";

function SelectDoctorPage() {
  const navigate = useNavigate();
  const { selection, selectDoctor } = useBooking();
  const specialty = selection.specialty;
  const [keyword, setKeyword] = useState("");

  const path = specialty ? `/api/master/bac-si?chuyen_khoa_id=${specialty.id}` : null;
  const { data, loading, error, reload } = useFetch(path);

  // Chưa chọn chuyên khoa (vào thẳng URL hoặc F5) -> quay về bước 1
  if (!specialty) {
    return <Navigate to={BOOKING_PATHS.specialty} replace />;
  }

  const doctors = data ?? [];
  const filtered = doctors.filter((d) =>
    removeDiacritics(d.ho_ten).includes(removeDiacritics(keyword.trim())),
  );

  const handleSelect = (doctor) => {
    selectDoctor({
      id: doctor.id,
      ho_ten: doctor.ho_ten,
      cap_bac: doctor.cap_bac,
      muc_phi: doctor.muc_phi,
      ten_chuyen_khoa: doctor.ten_chuyen_khoa,
    });
    navigate(BOOKING_PATHS.slot);
  };

  const handleRandom = () => {
    if (doctors.length === 0) return;
    handleSelect(doctors[Math.floor(Math.random() * doctors.length)]);
  };

  return (
    <div className="booking">
      <BookingHeader
        title="Chọn bác sĩ"
        step={2}
        label="Bác sĩ"
        onBack={() => navigate(BOOKING_PATHS.specialty)}
      >
        <p className="booking__sub">
          Chuyên khoa: <strong>{specialty.ten_chuyen_khoa}</strong>
        </p>
      </BookingHeader>

      <main className="booking__main">
        <input
          className="booking__search"
          type="text"
          placeholder="Tìm theo tên bác sĩ"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <div className="booking__card">
          <strong>Chưa rõ chọn bác sĩ nào?</strong>
          <p className="booking__sub">Hệ thống chọn giúp bạn một bác sĩ trong chuyên khoa</p>
          <button
            type="button"
            className="booking__btn booking__btn--outline"
            onClick={handleRandom}
            disabled={doctors.length === 0}
          >
            Ngẫu nhiên
          </button>
        </div>

        <div className="booking__section">
          <h2 className="booking__section-title">Danh sách bác sĩ</h2>
          {data && <span className="booking__section-count">{filtered.length} bác sĩ</span>}
        </div>

        {loading && <p className="booking__message">Đang tải danh sách bác sĩ...</p>}

        {error && (
          <div className="booking__message booking__message--error">
            <p>{error.message}</p>
            <button type="button" className="booking__btn booking__btn--outline" onClick={reload}>
              Thử lại
            </button>
          </div>
        )}

        {data && doctors.length === 0 && (
          <p className="booking__message">Chưa có bác sĩ thuộc chuyên khoa này.</p>
        )}

        {data && doctors.length > 0 && filtered.length === 0 && (
          <p className="booking__message">Không tìm thấy bác sĩ phù hợp.</p>
        )}

        {filtered.map((doctor) => (
          <button
            key={doctor.id}
            type="button"
            className="booking__item"
            onClick={() => handleSelect(doctor)}
          >
            <span className="booking__avatar">{getInitials(doctor.ho_ten)}</span>
            <span className="booking__item-body">
              <span className="booking__item-name">BS. {doctor.ho_ten}</span>
              <br />
              {doctor.cap_bac && <span className="booking__badge">{doctor.cap_bac}</span>}
              <br />
              <span className="booking__fee">
                Giá khám: <strong>{formatFee(doctor.muc_phi)}</strong>
              </span>
            </span>
            <span>›</span>
          </button>
        ))}
      </main>
    </div>
  );
}

export default SelectDoctorPage;