import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doctorPortalApi } from "../../api/doctorPortal";
import "./doctorPortal.css";

const FILTERS = [
  { value: "CHO_KHAM", label: "Chờ khám" },
  { value: "DANG_KHAM", label: "Đang khám" },
  { value: "DA_XONG", label: "Đã xong" },
];

const LANE_LABELS = { ONLINE: "Online", OFFLINE: "Offline" };

function DoctorHomePage() {
  const [status, setStatus] = useState("CHO_KHAM");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    doctorPortalApi
      .getPatients(status)
      .then((response) => {
        if (!cancelled) setData(response?.data);
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
  }, [status, reloadKey]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((value) => value + 1);
  };
  const selectStatus = (value) => {
    setLoading(true);
    setError(null);
    setStatus(value);
  };
  const current = data?.current_examination;

  return (
    <div className="dp-page">
      <header className="dp-header">
        <div>
          <p className="dp-eyebrow">KHU VỰC BÁC SĨ</p>
          <h1>Danh sách bệnh nhân</h1>
          <p className="dp-subtitle">
            {data?.doctor?.ho_ten ? `Bác sĩ ${data.doctor.ho_ten}` : "Theo dõi bệnh nhân trong ca hôm nay"}
            {data?.room?.ten_phong ? ` · ${data.room.ten_phong}` : ""}
          </p>
        </div>
        <Link className="dp-button dp-button--secondary" to="/doctor/call">
          Gọi bệnh nhân
        </Link>
      </header>

      {error && (
        <div className="dp-alert dp-alert--error" role="alert">
          <span>{error.message || "Không tải được danh sách bệnh nhân."}</span>
          <button type="button" className="dp-button dp-button--secondary" onClick={retry}>
            Thử lại
          </button>
        </div>
      )}

      {!error && data?.current_examination_conflict && (
        <section className="dp-alert dp-alert--warning" role="alert">
          <div>
            <strong>Có nhiều hồ sơ đang khám cùng lúc.</strong>
            <p>Hệ thống không tự chọn hồ sơ để tránh mở nhầm. Vui lòng liên hệ quản trị viên để xử lý.</p>
          </div>
        </section>
      )}

      {!error && current && (
        <section className="dp-resume">
          <div>
            <p className="dp-eyebrow">ĐANG CÓ HỒ SƠ KHÁM</p>
            <h2>{current.patient?.ho_ten || "Bệnh nhân"}</h2>
            <p>
              Hồ sơ #{current.ho_so_id}
              {current.room?.ten_phong ? ` · ${current.room.ten_phong}` : ""}
              {current.queue?.nhan_stt ? ` · Số ${current.queue.nhan_stt}` : ""}
            </p>
          </div>
          <Link
            className="dp-button dp-button--primary"
            to={`/doctor/examination/${encodeURIComponent(current.ho_so_id)}`}
          >
            Tiếp tục khám
          </Link>
        </section>
      )}

      <section className="dp-panel">
        <div className="dp-panel__heading">
          <div>
            <h2>Bệnh nhân trong ca</h2>
            <p>{data?.room?.ten_phong || "Chưa có phòng khám được phân công hôm nay"}</p>
          </div>
          <div className="dp-filters" role="tablist" aria-label="Lọc trạng thái bệnh nhân">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={status === filter.value}
                className={`dp-filter${status === filter.value ? " dp-filter--active" : ""}`}
                onClick={() => selectStatus(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="dp-state" role="status">Đang tải danh sách bệnh nhân...</p>}
        {!loading && !error && data?.items?.length === 0 && (
          <p className="dp-state">Không có bệnh nhân ở trạng thái “{FILTERS.find((item) => item.value === status)?.label}”.</p>
        )}
        {!loading && !error && data?.items?.length > 0 && (
          <div className="dp-patient-list">
            {data.items.map((item) => (
              <article className="dp-patient" key={item.hang_doi_id}>
                <div className="dp-patient__number">{item.nhan_stt || "—"}</div>
                <div className="dp-patient__info">
                  <strong>{item.patient?.ho_ten || "Chưa có tên"}</strong>
                  <span>
                    {LANE_LABELS[item.loai] || item.loai || "—"}
                    {item.gio_check_in ? ` · Check-in ${item.gio_check_in}` : ""}
                    {item.ho_so_id ? ` · Hồ sơ #${item.ho_so_id}` : ""}
                  </span>
                </div>
                <span className={`dp-status dp-status--${item.trang_thai.toLowerCase()}`}>
                  {FILTERS.find((filter) => filter.value === item.trang_thai)?.label || item.trang_thai}
                </span>
                {item.trang_thai === "DANG_KHAM" && item.ho_so_id && (
                  <Link
                    className="dp-button dp-button--secondary"
                    to={`/doctor/examination/${encodeURIComponent(item.ho_so_id)}`}
                  >
                    Mở hồ sơ
                  </Link>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default DoctorHomePage;
