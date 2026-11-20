import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { adminSchedulePaths } from "../../api/adminSchedules";
import { adminSpecialtyPaths } from "../../api/adminSpecialties";
import { adminDoctorPaths } from "../../api/adminDoctors";
import { adminRoomPaths } from "../../api/adminRooms";
import Button from "../../components/ui/Button";
import Notice from "../../components/ui/Notice";
import Badge from "../../components/ui/Badge";
import "./admin.css";

const pad = (n) => String(n).padStart(2, "0");

const formatDateIso = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatDisplayDate = (isoStr) => {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
};

const getMonday = (d) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
};

export default function AdminOverviewPage() {
  // Chế độ xem: "week" (theo tuần) hoặc "day" (theo ngày)
  const [viewMode, setViewMode] = useState("week");

  // Ngày hiện tại (theo giờ local)
  const [currentDate, setCurrentDate] = useState(() => formatDateIso(new Date()));

  // Tuần hiện tại
  const [currentMonday, setCurrentMonday] = useState(() => getMonday(new Date()));
  const weekStart = useMemo(() => formatDateIso(currentMonday), [currentMonday]);
  const weekEnd = useMemo(() => {
    const sunday = new Date(currentMonday);
    sunday.setDate(sunday.getDate() + 6);
    return formatDateIso(sunday);
  }, [currentMonday]);

  // Bộ lọc chuyên khoa, bác sĩ, phòng khám
  const [filterSpecialtyId, setFilterSpecialtyId] = useState("");
  const [filterDoctorId, setFilterDoctorId] = useState("");
  const [filterRoomId, setFilterRoomId] = useState("");

  // Tải danh mục phục vụ filter
  const { data: specialtyData } = useFetch(adminSpecialtyPaths.list());
  const specialties = specialtyData?.items || [];

  const { data: doctorData } = useFetch(
    adminDoctorPaths.list({
      chuyenKhoaId: filterSpecialtyId || undefined,
      limit: 500,
    })
  );
  const doctors = doctorData?.items || [];

  const { data: roomData } = useFetch(adminRoomPaths.list());
  const clinicRooms = (roomData?.items || []).filter((r) => r.loai_phong === "Phòng khám");

  // Xây dựng query path dựa theo mode và filters
  const schedulePath = useMemo(() => {
    const params = {
      chuyenKhoaId: filterSpecialtyId || undefined,
      bacSiId: filterDoctorId || undefined,
      phongKhamId: filterRoomId || undefined,
    };
    if (viewMode === "day") {
      params.date = currentDate;
    } else {
      params.startDate = weekStart;
      params.endDate = weekEnd;
    }
    return adminSchedulePaths.list(params);
  }, [viewMode, currentDate, weekStart, weekEnd, filterSpecialtyId, filterDoctorId, filterRoomId]);

  const { data: scheduleData, loading, error } = useFetch(schedulePath);
  const items = useMemo(() => scheduleData?.items || [], [scheduleData]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const totalSchedules = items.length;
    const uniqueDoctors = new Set(items.map((i) => i.bac_si_id)).size;
    const totalSlots = items.reduce((acc, i) => acc + (i.so_slot_toi_da || 0), 0);
    const totalOnlineSlots = items.reduce((acc, i) => acc + (i.so_slot_online || 0), 0);
    const bookedSlots = items.reduce((acc, i) => acc + (i.so_slot_da_dat || 0), 0);
    const fillRate = totalOnlineSlots > 0 ? Math.round((bookedSlots / totalOnlineSlots) * 100) : 0;

    return {
      totalSchedules,
      uniqueDoctors,
      totalSlots,
      totalOnlineSlots,
      bookedSlots,
      fillRate,
    };
  }, [items]);

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

  const handleThisWeek = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  const handleToday = () => {
    setCurrentDate(formatDateIso(new Date()));
  };

  const resetFilters = () => {
    setFilterSpecialtyId("");
    setFilterDoctorId("");
    setFilterRoomId("");
  };

  const hasActiveFilters = Boolean(filterSpecialtyId || filterDoctorId || filterRoomId);

  return (
    <div className="admin-page">
      <Link to="/admin" className="admin-back-link">
        ← Quay lại Trang quản trị
      </Link>

      <header className="admin-header">
        <div className="admin-header__title-row">
          <div>
            <span className="admin-header__badge">Tổng quan Lịch khám</span>
            <h1 className="admin-header__title">Tổng quan Lịch khám Toàn viện</h1>
            <p className="admin-header__desc">
              Bức tranh tổng thể lịch khám của tất cả bác sĩ theo ngày hoặc tuần. Giúp điều phối nguồn lực y tế và theo dõi tỉ lệ đặt chỗ.
            </p>
          </div>
          <div className="admin-actions">
            <Link to="/admin/schedules" className="admin-btn admin-btn--primary" style={{ textDecoration: "none" }}>
              + Phân công ca trực
            </Link>
          </div>
        </div>
      </header>

      {/* Thẻ thống kê KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        <div className="admin-module-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>TỔNG SỐ CA TRỰC</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--primary, #1e88e5)", marginTop: "4px" }}>
            {stats.totalSchedules}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            {viewMode === "day" ? "Trong ngày được chọn" : "Trong tuần được chọn"}
          </div>
        </div>

        <div className="admin-module-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>BÁC SĨ CÓ LỊCH</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
            {stats.uniqueDoctors}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            Bác sĩ đang được phân công
          </div>
        </div>

        <div className="admin-module-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>TỔNG SLOT KHÁM</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>
            {stats.totalSlots}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            Online: {stats.totalOnlineSlots} | Offline: {stats.totalSlots - stats.totalOnlineSlots}
          </div>
        </div>

        <div className="admin-module-card" style={{ padding: "16px 20px" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>SLOT ĐÃ ĐẶT (ONLINE)</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: stats.fillRate > 80 ? "var(--danger, #d64545)" : "var(--success, #16a34a)", marginTop: "4px" }}>
            {stats.bookedSlots} <span style={{ fontSize: "16px", fontWeight: 500, color: "var(--text-muted)" }}>({stats.fillRate}%)</span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
            Đã đăng ký / Tổng online
          </div>
        </div>
      </div>

      {/* Toolbar điều khiển thời gian và bộ lọc */}
      <div className="admin-toolbar" style={{ flexDirection: "column", alignItems: "stretch", gap: "14px" }}>
        {/* Hàng 1: Switch chế độ ngày/tuần và điều hướng thời gian */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              className={`admin-btn ${viewMode === "week" ? "admin-btn--primary" : "admin-btn--secondary"}`}
              style={{ padding: "6px 14px", fontSize: "13px" }}
              onClick={() => setViewMode("week")}
            >
              Xem theo tuần
            </button>
            <button
              type="button"
              className={`admin-btn ${viewMode === "day" ? "admin-btn--primary" : "admin-btn--secondary"}`}
              style={{ padding: "6px 14px", fontSize: "13px" }}
              onClick={() => setViewMode("day")}
            >
              Xem theo ngày
            </button>
          </div>

          {viewMode === "week" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Button variant="secondary" size="sm" onClick={handlePrevWeek} title="Tuần trước">
                ← Tuần trước
              </Button>
              <Button variant="secondary" size="sm" onClick={handleThisWeek}>
                Tuần này
              </Button>
              <Button variant="secondary" size="sm" onClick={handleNextWeek} title="Tuần sau">
                Tuần sau →
              </Button>
              <span style={{ fontWeight: 600, fontSize: "14px", marginLeft: "8px" }}>
                {formatDisplayDate(weekStart)} – {formatDisplayDate(weekEnd)}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Button variant="secondary" size="sm" onClick={handleToday}>
                Hôm nay
              </Button>
              <input
                type="date"
                className="admin-input"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                style={{ height: "34px" }}
              />
              <span style={{ fontWeight: 600, fontSize: "14px", marginLeft: "4px" }}>
                Ngày: {formatDisplayDate(currentDate)}
              </span>
            </div>
          )}
        </div>

        {/* Hàng 2: Bộ lọc Chuyên khoa / Bác sĩ / Phòng */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
            Bộ lọc:
          </span>

          <select
            className="admin-select"
            value={filterSpecialtyId}
            onChange={(e) => {
              setFilterSpecialtyId(e.target.value);
              setFilterDoctorId(""); // reset doctor khi đổi chuyên khoa
            }}
            aria-label="Lọc theo chuyên khoa"
          >
            <option value="">Tất cả chuyên khoa</option>
            {specialties.map((ck) => (
              <option key={ck.id} value={ck.id}>
                {ck.ten_chuyen_khoa}
              </option>
            ))}
          </select>

          <select
            className="admin-select"
            value={filterDoctorId}
            onChange={(e) => setFilterDoctorId(e.target.value)}
            aria-label="Lọc theo bác sĩ"
          >
            <option value="">Tất cả bác sĩ</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ho_ten} ({d.chuyen_khoa?.ten_chuyen_khoa || "Chưa có CK"})
              </option>
            ))}
          </select>

          <select
            className="admin-select"
            value={filterRoomId}
            onChange={(e) => setFilterRoomId(e.target.value)}
            aria-label="Lọc theo phòng khám"
          >
            <option value="">Tất cả phòng khám</option>
            {clinicRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.ten_phong}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              Đặt lại bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Bảng dữ liệu tổng quan lịch */}
      {loading && (
        <div className="admin-state-box">
          <div className="admin-spinner" />
          <span>Đang tải tổng quan lịch...</span>
        </div>
      )}

      {error && !loading && (
        <Notice variant="error" title="Không thể tải tổng quan lịch">
          {error.message || "Đã xảy ra lỗi khi kết nối tới máy chủ."}
        </Notice>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="admin-state-box">
          <p style={{ margin: 0, fontWeight: 500 }}>Không tìm thấy lịch khám nào phù hợp.</p>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
            {hasActiveFilters
              ? "Hãy thử thay đổi hoặc đặt lại bộ lọc để xem các ca trực khác."
              : "Chưa có bác sĩ nào được phân công trực trong khoảng thời gian này."}
          </p>
          {hasActiveFilters ? (
            <Button variant="secondary" size="sm" onClick={resetFilters} style={{ marginTop: "6px" }}>
              Đặt lại bộ lọc
            </Button>
          ) : (
            <Link to="/admin/schedules" className="admin-btn admin-btn--primary" style={{ marginTop: "6px", textDecoration: "none" }}>
              + Phân công lịch trực
            </Link>
          )}
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Giờ khám</th>
                <th>Bác sĩ</th>
                <th>Chuyên khoa</th>
                <th>Phòng khám</th>
                <th>Đã đặt / Tổng slot</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const isFull = row.so_slot_da_dat >= row.so_slot_online && row.so_slot_online > 0;
                const percent = row.so_slot_online > 0 ? Math.round((row.so_slot_da_dat / row.so_slot_online) * 100) : 0;
                return (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <strong>{formatDisplayDate(row.ngay)}</strong>
                    </td>
                    <td style={{ whiteSpace: "nowrap", fontFamily: "monospace", fontWeight: 600 }}>
                      {row.gio_bat_dau} – {row.gio_ket_thuc}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.bac_si?.ho_ten}</div>
                      {row.bac_si?.cap_bac && (
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          {row.bac_si.cap_bac}
                        </div>
                      )}
                    </td>
                    <td>
                      <Badge variant="info">
                        {row.chuyen_khoa?.ten_chuyen_khoa || "—"}
                      </Badge>
                    </td>
                    <td>
                      <strong>{row.phong_kham?.ten_phong || "—"}</strong>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 600, color: isFull ? "var(--danger)" : "inherit" }}>
                            {row.so_slot_da_dat}
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>/ {row.so_slot_toi_da} slot (Online: {row.so_slot_online})</span>
                        </div>
                        {/* Thanh mini visual progress */}
                        <div
                          style={{
                            height: "4px",
                            width: "120px",
                            background: "var(--border, #e5e7eb)",
                            borderRadius: "2px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(percent, 100)}%`,
                              background: isFull ? "var(--danger, #d64545)" : "var(--primary, #1e88e5)",
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge variant={row.trang_thai === "HoatDong" ? (isFull ? "warning" : "success") : "neutral"}>
                        {row.trang_thai === "HoatDong" ? (isFull ? "Hết chỗ online" : "Hoạt động") : row.trang_thai}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
