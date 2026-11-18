import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { adminScheduleApi, adminSchedulePaths } from "../../api/adminSchedules";
import { adminDoctorPaths } from "../../api/adminDoctors";
import { adminRoomPaths } from "../../api/adminRooms";
import { adminTimeSlotPaths } from "../../api/adminTimeSlots";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import Badge from "../../components/ui/Badge";
import "./admin.css";

const SHORT_DAYS = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];
const FULL_DAYS = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];

const pad = (n) => String(n).padStart(2, "0");

const formatDateIso = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatDisplayDate = (isoStr) => {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
};

// Lấy thứ 2 của tuần chứa date
const getMonday = (d) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

const buildWeekDays = (monday) => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const iso = formatDateIso(d);
    return {
      iso,
      dayName: FULL_DAYS[d.getDay()],
      shortName: SHORT_DAYS[d.getDay()],
      display: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
    };
  });
};

function Modal({ title, onClose, disabled, children, footer }) {
  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="admin-modal"
        style={{ maxWidth: "680px" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="admin-modal__header">
          <h2 className="admin-modal__title">{title}</h2>
          <button
            type="button"
            className="admin-modal__close"
            onClick={onClose}
            disabled={disabled}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <div className="admin-modal__body">{children}</div>
        {footer && <div className="admin-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

export default function AdminSchedulesPage() {
  // Tuần hiện tại
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const weekDays = useMemo(() => buildWeekDays(currentMonday), [currentMonday]);
  const startDate = weekDays[0].iso;
  const endDate = weekDays[6].iso;

  // Bộ lọc danh sách tuần
  const [filterDoctorId, setFilterDoctorId] = useState("");
  const [filterRoomId, setFilterRoomId] = useState("");

  // Tải danh sách lịch tuần
  const schedulePath = adminSchedulePaths.list({
    startDate,
    endDate,
    bacSiId: filterDoctorId || undefined,
    phongKhamId: filterRoomId || undefined,
  });
  const { data: scheduleData, loading: scheduleLoading, error: scheduleError, reload: reloadSchedules } =
    useFetch(schedulePath);
  const schedules = scheduleData?.items || [];

  // Tải dữ liệu phục vụ phân công: Bác sĩ, Phòng khám, Khung giờ
  const { data: doctorData } = useFetch(adminDoctorPaths.list({ limit: 500 }));
  const doctors = doctorData?.items || [];

  const { data: roomData } = useFetch(adminRoomPaths.list());
  const clinicRooms = (roomData?.items || []).filter((r) => r.loai_phong === "Phòng khám");

  const { data: timeSlotData } = useFetch(adminTimeSlotPaths.list());
  const timeSlots = timeSlotData?.items || [];

  // Modal phân công lịch trực (UC-030)
  const [showModal, setShowModal] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => weekDays[0].iso);
  const [selectedSlotIds, setSelectedSlotIds] = useState([]);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [flash, setFlash] = useState(null);

  // Điều hướng tuần
  const handlePrevWeek = () => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setCurrentMonday((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleCurrentWeek = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  // Mở modal tạo lịch
  const openCreateModal = () => {
    setSelectedDoctorId(filterDoctorId || (doctors[0] ? String(doctors[0].id) : ""));
    setSelectedRoomId(filterRoomId || "");
    setSelectedDate(startDate);
    setSelectedSlotIds([]);
    setModalError("");
    setShowModal(true);
  };

  // Lọc phòng phù hợp với bác sĩ đã chọn
  const selectedDoctor = doctors.find((d) => String(d.id) === selectedDoctorId);
  const suitableRooms = clinicRooms.filter((r) => {
    if (!selectedDoctor?.chuyen_khoa?.id) return true;
    return !r.chuyen_khoa?.id || r.chuyen_khoa.id === selectedDoctor.chuyen_khoa.id;
  });

  // Chọn/bỏ chọn khung giờ
  const toggleSlot = (id) => {
    setSelectedSlotIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllSlots = () => {
    setSelectedSlotIds(timeSlots.map((s) => s.id));
  };

  const selectMorningSlots = () => {
    const morningIds = timeSlots.filter((s) => s.ca === "SANG").map((s) => s.id);
    setSelectedSlotIds(morningIds);
  };

  const selectAfternoonSlots = () => {
    const afternoonIds = timeSlots.filter((s) => s.ca === "CHIEU").map((s) => s.id);
    setSelectedSlotIds(afternoonIds);
  };

  const deselectAllSlots = () => {
    setSelectedSlotIds([]);
  };

  // Submit tạo lịch trực
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setModalError("Vui lòng chọn bác sĩ.");
      return;
    }
    if (!selectedRoomId) {
      setModalError("Vui lòng chọn phòng khám.");
      return;
    }
    if (!selectedDate) {
      setModalError("Vui lòng chọn ngày khám.");
      return;
    }
    if (selectedSlotIds.length === 0) {
      setModalError("Vui lòng chọn ít nhất một khung giờ khám.");
      return;
    }

    setModalSaving(true);
    setModalError("");
    try {
      const res = await adminScheduleApi.create({
        bac_si_id: Number(selectedDoctorId),
        phong_kham_id: Number(selectedRoomId),
        ngay: selectedDate,
        khung_gio_ids: selectedSlotIds,
      });

      setFlash({
        type: "success",
        message: res.message || `Đã phân công ${selectedSlotIds.length} ca trực thành công.`,
      });
      setShowModal(false);
      reloadSchedules();
    } catch (err) {
      setModalError(err.message || "Không thể phân công lịch trực.");
    } finally {
      setModalSaving(false);
    }
  };

  // Xóa lịch trực (chỉ khi chưa có bệnh nhân đặt hẹn)
  const handleDeleteSchedule = async (schedule) => {
    if (schedule.so_slot_da_dat > 0) {
      alert("Lịch trực đã có bệnh nhân đặt hẹn, không thể xóa.");
      return;
    }
    const confirmDelete = window.confirm(
      `Xác nhận xóa ca trực ${schedule.gio_bat_dau} - ${schedule.gio_ket_thuc} ngày ${formatDisplayDate(schedule.ngay)} của BS. ${schedule.bac_si?.ho_ten}?`
    );
    if (!confirmDelete) return;

    try {
      await adminScheduleApi.delete(schedule.id);
      setFlash({
        type: "success",
        message: "Đã xóa lịch trực thành công.",
      });
      reloadSchedules();
    } catch (err) {
      setFlash({
        type: "error",
        message: err.message || "Không thể xóa lịch trực.",
      });
    }
  };

  // Phân nhóm khung giờ theo ca
  const morningSlots = timeSlots.filter((s) => s.ca === "SANG");
  const afternoonSlots = timeSlots.filter((s) => s.ca === "CHIEU");

  return (
    <div className="admin-page">
      <Link to="/admin" className="admin-back-link">
        ← Quay lại Trang quản trị
      </Link>

      <header className="admin-header">
        <div className="admin-header__title-row">
          <div>
            <span className="admin-header__badge">Scheduling Core (C6-07)</span>
            <h1 className="admin-header__title">Phân công Lịch trực Bác sĩ</h1>
            <p className="admin-header__desc">
              Phân công ca khám và phòng trực cho bác sĩ theo tuần và ngày. Capacity được lấy tự động từ cấu hình khung giờ.
            </p>
          </div>
          <div className="admin-actions">
            <Link to="/admin/overview" className="admin-btn admin-btn--secondary" style={{ textDecoration: "none" }}>
              Xem tổng quan lịch →
            </Link>
            <Button variant="primary" onClick={openCreateModal}>
              + Phân công lịch trực
            </Button>
          </div>
        </div>
      </header>

      {flash && (
        <div className={`admin-flash admin-flash--${flash.type}`} role="status">
          <span>{flash.message}</span>
          <button
            type="button"
            className="admin-modal__close"
            style={{ fontSize: "16px" }}
            onClick={() => setFlash(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Thanh điều hướng tuần và bộ lọc */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Button variant="secondary" size="sm" onClick={handlePrevWeek} title="Tuần trước">
              ← Tuần trước
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCurrentWeek}>
              Tuần hiện tại
            </Button>
            <Button variant="secondary" size="sm" onClick={handleNextWeek} title="Tuần sau">
              Tuần sau →
            </Button>
          </div>
          <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>
            Tuần: {formatDisplayDate(startDate)} – {formatDisplayDate(endDate)}
          </div>
        </div>

        <div className="admin-toolbar__filters">
          <select
            className="admin-select"
            value={filterDoctorId}
            onChange={(e) => setFilterDoctorId(e.target.value)}
            aria-label="Lọc theo bác sĩ"
          >
            <option value="">Tất cả bác sĩ</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ho_ten} ({d.chuyen_khoa?.ten_chuyen_khoa || "Chưa gán CK"})
              </option>
            ))}
          </select>

          <select
            className="admin-select"
            value={filterRoomId}
            onChange={(e) => setFilterRoomId(e.target.value)}
            aria-label="Lọc theo phòng"
          >
            <option value="">Tất cả phòng khám</option>
            {clinicRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.ten_phong}
              </option>
            ))}
          </select>

          {(filterDoctorId || filterRoomId) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFilterDoctorId("");
                setFilterRoomId("");
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Bảng danh sách lịch trực trong tuần */}
      {scheduleLoading && (
        <div className="admin-state-box">
          <div className="admin-spinner" />
          <span>Đang tải lịch trực tuần...</span>
        </div>
      )}

      {scheduleError && !scheduleLoading && (
        <Notice variant="error" title="Không thể tải lịch trực">
          {scheduleError.message || "Đã xảy ra lỗi khi kết nối tới máy chủ."}
        </Notice>
      )}

      {!scheduleLoading && !scheduleError && schedules.length === 0 && (
        <div className="admin-state-box">
          <p style={{ margin: 0, fontWeight: 500 }}>Chưa có lịch trực nào trong tuần này.</p>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
            Nhấn nút &ldquo;+ Phân công lịch trực&rdquo; ở trên để bắt đầu gán ca trực cho bác sĩ.
          </p>
          <Button variant="primary" size="sm" onClick={openCreateModal} style={{ marginTop: "8px" }}>
            + Phân công lịch trực
          </Button>
        </div>
      )}

      {!scheduleLoading && !scheduleError && schedules.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Khung giờ</th>
                <th>Bác sĩ</th>
                <th>Chuyên khoa</th>
                <th>Phòng khám</th>
                <th>Capacity (Đặt/Online/Tối đa)</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => {
                const isFull = s.so_slot_da_dat >= s.so_slot_online && s.so_slot_online > 0;
                return (
                  <tr key={s.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <strong>{formatDisplayDate(s.ngay)}</strong>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontWeight: 600 }}>
                      {s.gio_bat_dau} – {s.gio_ket_thuc}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.bac_si?.ho_ten}</div>
                      {s.bac_si?.cap_bac && (
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          {s.bac_si.cap_bac}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge variant="info">
                        {s.chuyen_khoa?.ten_chuyen_khoa || "—"}
                      </Badge>
                    </td>
                    <td>
                      <strong>{s.phong_kham?.ten_phong || "—"}</strong>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontWeight: 600, color: isFull ? "var(--danger)" : "inherit" }}>
                          {s.so_slot_da_dat}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>/ {s.so_slot_online} online / {s.so_slot_toi_da} tổng</span>
                      </div>
                    </td>
                    <td>
                      <Badge variant={s.trang_thai === "HoatDong" ? (isFull ? "warning" : "success") : "neutral"}>
                        {s.trang_thai === "HoatDong" ? (isFull ? "Hết chỗ online" : "Hoạt động") : s.trang_thai}
                      </Badge>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary"
                        style={{
                          padding: "4px 10px",
                          fontSize: "12px",
                          color: s.so_slot_da_dat > 0 ? "var(--text-muted)" : "var(--danger)",
                        }}
                        disabled={s.so_slot_da_dat > 0}
                        title={
                          s.so_slot_da_dat > 0
                            ? "Đã có bệnh nhân đặt hẹn trong ca này, không thể xóa"
                            : "Xóa ca trực này"
                        }
                        onClick={() => handleDeleteSchedule(s)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Phân công Lịch trực (UC-030) */}
      {showModal && (
        <Modal
          title="Phân công Lịch trực Bác sĩ (UC-030)"
          onClose={() => !modalSaving && setShowModal(false)}
          disabled={modalSaving}
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowModal(false)}
                disabled={modalSaving}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveSchedule}
                disabled={modalSaving || selectedSlotIds.length === 0}
              >
                {modalSaving ? "Đang lưu..." : `Lưu phân công (${selectedSlotIds.length} ca)`}
              </Button>
            </>
          }
        >
          {modalError && (
            <div style={{ marginBottom: "16px" }}>
              <Notice variant="error" title="Lỗi phân công lịch trực">
                {modalError}
              </Notice>
            </div>
          )}

          <form onSubmit={handleSaveSchedule}>
            <div className="admin-form-group">
              <label htmlFor="sched-doctor" className="admin-form-label">
                Bác sĩ phụ trách <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                id="sched-doctor"
                className="admin-select"
                style={{ width: "100%" }}
                value={selectedDoctorId}
                onChange={(e) => {
                  setSelectedDoctorId(e.target.value);
                  setSelectedRoomId(""); // reset phòng khi đổi bác sĩ để tránh mismatch chuyên khoa
                }}
                disabled={modalSaving}
                required
              >
                <option value="">-- Chọn bác sĩ --</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.ho_ten} ({d.chuyen_khoa?.ten_chuyen_khoa || "Chưa có CK"}) {d.cap_bac ? ` - ${d.cap_bac}` : ""}
                  </option>
                ))}
              </select>
              {selectedDoctor && (
                <div className="admin-form-hint">
                  Chuyên khoa: <strong>{selectedDoctor.chuyen_khoa?.ten_chuyen_khoa || "Chưa gán"}</strong>
                </div>
              )}
            </div>

            <div className="admin-form-group">
              <label htmlFor="sched-room" className="admin-form-label">
                Phòng khám <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <select
                id="sched-room"
                className="admin-select"
                style={{ width: "100%" }}
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                disabled={modalSaving}
                required
              >
                <option value="">-- Chọn phòng khám --</option>
                {suitableRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.ten_phong} {r.chuyen_khoa ? `(${r.chuyen_khoa.ten_chuyen_khoa})` : "(Đa khoa)"}
                  </option>
                ))}
              </select>
              {suitableRooms.length === 0 && (
                <div className="admin-form-hint" style={{ color: "var(--danger)" }}>
                  Không tìm thấy phòng khám phù hợp với chuyên khoa của bác sĩ.
                </div>
              )}
            </div>

            <div className="admin-form-group">
              <label htmlFor="sched-date" className="admin-form-label">
                Ngày khám <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                id="sched-date"
                type="date"
                className="admin-input"
                style={{ width: "100%" }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={modalSaving}
                required
              />
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                {weekDays.map((w) => (
                  <button
                    key={w.iso}
                    type="button"
                    className={`admin-btn ${selectedDate === w.iso ? "" : "admin-btn--secondary"}`}
                    style={{ padding: "4px 8px", fontSize: "12px" }}
                    onClick={() => setSelectedDate(w.iso)}
                  >
                    {w.shortName} ({w.display})
                  </button>
                ))}
              </div>
            </div>

            <div className="admin-form-group">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span className="admin-form-label" style={{ margin: 0 }}>
                  Khung giờ khám (Cấu hình C6-06) <span style={{ color: "var(--danger)" }}>*</span>
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    style={{ padding: "2px 8px", fontSize: "11px" }}
                    onClick={selectMorningSlots}
                  >
                    Ca sáng
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    style={{ padding: "2px 8px", fontSize: "11px" }}
                    onClick={selectAfternoonSlots}
                  >
                    Ca chiều
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    style={{ padding: "2px 8px", fontSize: "11px" }}
                    onClick={selectAllSlots}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    style={{ padding: "2px 8px", fontSize: "11px" }}
                    onClick={deselectAllSlots}
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {timeSlots.length === 0 ? (
                <div className="admin-form-hint">Đang tải cấu hình khung giờ...</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Ca sáng */}
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                      Ca sáng (06:00 – 11:00)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
                      {morningSlots.map((slot) => {
                        const checked = selectedSlotIds.includes(slot.id);
                        return (
                          <label
                            key={slot.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              border: `1px solid ${checked ? "var(--primary, #1e88e5)" : "var(--border, #e5e7eb)"}`,
                              background: checked ? "var(--primary-light, #eff6ff)" : "var(--surface, #ffffff)",
                              borderRadius: "8px",
                              cursor: "pointer",
                              fontSize: "13px",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSlot(slot.id)}
                              disabled={modalSaving}
                            />
                            <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                              {slot.gio_bat_dau} – {slot.gio_ket_thuc}
                            </span>
                            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginLeft: "auto" }}>
                              {slot.so_slot_online} onl / {slot.so_slot_toi_da} tổng
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ca chiều */}
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
                      Ca chiều (13:00 – 16:00)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "8px" }}>
                      {afternoonSlots.map((slot) => {
                        const checked = selectedSlotIds.includes(slot.id);
                        return (
                          <label
                            key={slot.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              border: `1px solid ${checked ? "var(--primary, #1e88e5)" : "var(--border, #e5e7eb)"}`,
                              background: checked ? "var(--primary-light, #eff6ff)" : "var(--surface, #ffffff)",
                              borderRadius: "8px",
                              cursor: "pointer",
                              fontSize: "13px",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleSlot(slot.id)}
                              disabled={modalSaving}
                            />
                            <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                              {slot.gio_bat_dau} – {slot.gio_ket_thuc}
                            </span>
                            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginLeft: "auto" }}>
                              {slot.so_slot_online} onl / {slot.so_slot_toi_da} tổng
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
