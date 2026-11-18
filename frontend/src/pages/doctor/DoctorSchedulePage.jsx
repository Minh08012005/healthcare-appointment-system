import { useEffect, useState } from "react";
import { doctorPortalApi } from "../../api/doctorPortal";
import "./doctorPortal.css";

const shiftDate = (date, offset) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
};

const formatDate = (value, options = { day: "2-digit", month: "2-digit", year: "numeric" }) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("vi-VN", { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
};

const STATUS_LABELS = {
  HoatDong: "Đang mở",
  HetCho: "Hết chỗ online",
  DaHuy: "Đã hủy",
};

function DoctorSchedulePage() {
  const [weekStart, setWeekStart] = useState(null);
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    doctorPortalApi
      .getSchedules(weekStart)
      .then((response) => {
        if (cancelled) return;
        setWeek(response?.data || null);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart, reloadKey]);

  const days = week
    ? Array.from({ length: 7 }, (_, index) => shiftDate(week.start_date, index))
    : [];
  const loadWeek = (startDate) => {
    setLoading(true);
    setError(null);
    setWeekStart(startDate);
  };
  const retry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((value) => value + 1);
  };
  const schedulesByDate = new Map();
  for (const schedule of week?.items || []) {
    if (!schedulesByDate.has(schedule.ngay)) schedulesByDate.set(schedule.ngay, []);
    schedulesByDate.get(schedule.ngay).push(schedule);
  }

  return (
    <div className="dp-page">
      <header className="dp-header">
        <div>
          <p className="dp-eyebrow">KHU VỰC BÁC SĨ</p>
          <h1>Lịch trực</h1>
          <p className="dp-subtitle">
            {week ? `Tuần ${formatDate(week.start_date)} – ${formatDate(week.end_date)}` : "Lịch trực theo tuần"}
          </p>
        </div>
        <div className="dp-week-controls">
          <button
            type="button"
            className="dp-button dp-button--secondary"
            disabled={!week}
            onClick={() => loadWeek(shiftDate(week.start_date, -7))}
          >
            Tuần trước
          </button>
          <button
            type="button"
            className="dp-button dp-button--secondary"
            disabled={!week}
            onClick={() => loadWeek(shiftDate(week.start_date, 7))}
          >
            Tuần sau
          </button>
        </div>
      </header>

      {error && (
        <div className="dp-alert dp-alert--error" role="alert">
          <span>{error.message || "Không tải được lịch trực."}</span>
          <button
            type="button"
            className="dp-button dp-button--secondary"
            onClick={retry}
          >
            Thử lại
          </button>
        </div>
      )}

      {loading && <p className="dp-state" role="status">Đang tải lịch trực...</p>}
      {!loading && !error && week?.items?.length === 0 && (
        <section className="dp-panel dp-empty">
          <h2>Tuần này chưa có lịch trực</h2>
          <p>Lịch sẽ hiển thị tại đây sau khi được phân công.</p>
        </section>
      )}
      {!loading && !error && week?.items?.length > 0 && (
        <div className="dp-schedule">
          {days.map((day) => {
            const schedules = schedulesByDate.get(day) || [];
            return (
              <section className="dp-panel dp-day" key={day}>
                <div className="dp-day__heading">
                  <h2>{formatDate(day, { weekday: "long", day: "2-digit", month: "2-digit" })}</h2>
                  <span>{schedules.length} ca</span>
                </div>
                {schedules.length === 0 ? (
                  <p className="dp-day__empty">Không có ca trực</p>
                ) : (
                  <div className="dp-shifts">
                    {schedules.map((schedule) => (
                      <article className="dp-shift" key={schedule.id}>
                        <div className="dp-shift__time">
                          {schedule.gio_bat_dau} – {schedule.gio_ket_thuc}
                        </div>
                        <div className="dp-shift__details">
                          <strong>{schedule.phong_kham?.ten_phong || "Chưa xác định phòng"}</strong>
                          <span>{schedule.chuyen_khoa?.ten_chuyen_khoa || "Chưa có chuyên khoa"}</span>
                        </div>
                        <span className={`dp-status${schedule.trang_thai === "DaHuy" ? " dp-status--cancelled" : ""}`}>
                          {STATUS_LABELS[schedule.trang_thai] || schedule.trang_thai || "—"}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DoctorSchedulePage;
