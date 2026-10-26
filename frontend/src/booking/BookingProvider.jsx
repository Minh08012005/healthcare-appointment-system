import { useState } from "react";
import { BookingContext } from "./BookingContext";

const EMPTY_SELECTION = {
  specialty: null, // { id, ten_chuyen_khoa }
  doctor: null, // { id, ho_ten, cap_bac, muc_phi, ten_chuyen_khoa }
  date: "", // "YYYY-MM-DD"
  slot: null, // { lich_kham_id, phong_kham_id, ten_phong, gio_bat_dau, gio_ket_thuc, slot_con_lai }
};

function BookingProvider({ children }) {
  const [selection, setSelection] = useState(EMPTY_SELECTION);

  // Đổi chuyên khoa: xóa bác sĩ, ngày, giờ phía sau
  const selectSpecialty = (specialty) =>
    setSelection({ specialty, doctor: null, date: "", slot: null });

  // Đổi bác sĩ: xóa ngày, giờ phía sau
  const selectDoctor = (doctor) =>
    setSelection((prev) => ({ ...prev, doctor, date: "", slot: null }));

  // Đổi ngày: xóa giờ đã chọn.
  // Bấm lại chính ngày đang chọn thì giữ nguyên ngày + giờ đã chọn.
  const selectDate = (date) =>
    setSelection((prev) =>
      prev.date === date ? prev : { ...prev, date, slot: null },
    );

  const selectSlot = (slot) => setSelection((prev) => ({ ...prev, slot }));

  const resetBooking = () => setSelection(EMPTY_SELECTION);

  return (
    <BookingContext.Provider
      value={{ selection, selectSpecialty, selectDoctor, selectDate, selectSlot, resetBooking }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export default BookingProvider;