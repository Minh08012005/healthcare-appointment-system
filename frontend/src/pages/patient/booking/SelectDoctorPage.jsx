import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import BookingHeader from "./BookingHeader";
import BookingIcon from "./BookingIcons";
import { BOOKING_PATHS } from "./bookingPaths";
import { formatFee, getInitials, removeDiacritics } from "./bookingFormat";
import { useBooking } from "../../../booking/useBooking";
import { useFetch } from "../../../api/useFetch";
import { PatientLoading, PatientError, PatientEmpty } from "../../../components/patient/PatientState";
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
        <div className="booking__search-wrap">
          <span className="booking__search-icon" aria-hidden="true">
            <BookingIcon name="search" size={16} />
          </span>
          <input
            className="booking__search"
            type="search"
            placeholder="Tìm theo tên bác sĩ..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="Tìm theo tên bác sĩ"
          />
        </div>

        <div className="booking__card booking__card--allocate">
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

        {loading && <PatientLoading text="Đang tải danh sách bác sĩ..." />}

        {error && <PatientError error={error} onRetry={reload} />}

        {data && doctors.length === 0 && (
          <PatientEmpty
            title="Chưa có bác sĩ"
            description="Hiện chưa có bác sĩ nào thuộc chuyên khoa này đang mở lịch khám."
            icon="medical"
          />
        )}

        {data && doctors.length > 0 && filtered.length === 0 && (
          <PatientEmpty
            title="Không tìm thấy bác sĩ"
            description="Không có bác sĩ nào khớp với từ khóa tìm kiếm. Vui lòng thử lại."
            icon="search"
          />
        )}

        {filtered.map((doctor) => (
          <button
            key={doctor.id}
            type="button"
            className="booking__item booking__item--doctor"
            onClick={() => handleSelect(doctor)}
          >
            <span className="booking__avatar">{getInitials(doctor.ho_ten)}</span>
            <span className="booking__item-body">
              <span className="booking__item-name">
                {doctor.cap_bac ? `${doctor.cap_bac} ` : "BS. "}
                {doctor.ho_ten}
              </span>
              <span className="booking__doctor-meta">
                {doctor.cap_bac && <span className="booking__badge">{doctor.cap_bac}</span>}
                <span className="booking__fee">
                  Phí khám: <strong>{formatFee(doctor.muc_phi)}</strong>
                </span>
              </span>
            </span>
            <span className="booking__item-arrow" aria-hidden="true">
              <BookingIcon name="arrowRight" size={16} />
            </span>
          </button>
        ))}
      </main>
    </div>
  );
}

export default SelectDoctorPage;