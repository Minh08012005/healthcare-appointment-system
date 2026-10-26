import { useState } from "react";
import { BookingContext } from "./BookingContext";
import { useAuth } from "../auth/useAuth";

const EMPTY_SELECTION = {
  specialty: null, // { id, ten_chuyen_khoa }
  doctor: null, // { id, ho_ten, cap_bac, muc_phi, ten_chuyen_khoa }
  date: "", // "YYYY-MM-DD"
  slot: null, // { lich_kham_id, phong_kham_id, ten_phong, gio_bat_dau, gio_ket_thuc, slot_con_lai }
};

// C2-07: thông tin bệnh nhân nhập ở BN11
const EMPTY_INFO = {
  su_dung_bhyt: null, // true | false | null (chưa chọn)
  trieu_chung: "",
};

function BookingProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [info, setInfo] = useState(EMPTY_INFO);
  const [result, setResult] = useState(null); // data trả về từ POST /api/appointments

  // Đổi tài khoản / logout: xóa dữ liệu đặt lịch của người trước
  const [ownerId, setOwnerId] = useState(userId);
  if (ownerId !== userId) {
    setOwnerId(userId);
    setSelection(EMPTY_SELECTION);
    setInfo(EMPTY_INFO);
    setResult(null);
  }

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

  const updateInfo = (patch) => setInfo((prev) => ({ ...prev, ...patch }));

  // Đặt lịch thành công: lưu kết quả cho BN13, xóa selection để không submit lại
  const completeBooking = (data) => {
    setResult(data);
    setSelection(EMPTY_SELECTION);
    setInfo(EMPTY_INFO);
  };

  const resetBooking = () => {
    setSelection(EMPTY_SELECTION);
    setInfo(EMPTY_INFO);
    setResult(null);
  };

  return (
    <BookingContext.Provider
      value={{
        selection,
        info,
        result,
        selectSpecialty,
        selectDoctor,
        selectDate,
        selectSlot,
        updateInfo,
        completeBooking,
        resetBooking,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export default BookingProvider;