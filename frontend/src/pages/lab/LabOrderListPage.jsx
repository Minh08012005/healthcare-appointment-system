import { Link, useSearchParams } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { labRoomPaths } from "../../api/labRoom";
import { LAB_STATUS, formatDateTime, show, statusClass, statusLabel } from "./labHelpers";
import "../doctor/call/callPatient.css"; // tái dùng cp-btn, cp-state, cp-spinner
import "./lab.css";

const FILTERS = [
  { value: "", label: "Tất cả" },
  ...Object.entries(LAB_STATUS).map(([value, s]) => ({ value, label: s.label })),
];

function LabOrderListPage() {
  // Filter lưu trên URL (?trang_thai=) -> F5 vẫn giữ đúng tab
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("trang_thai") || "";
  const trangThai = LAB_STATUS[raw] ? raw : "";

  const { data, loading, error, reload } = useFetch(labRoomPaths.list(trangThai));
  const items = data?.items || [];

  const changeFilter = (value) =>
    setSearchParams(value ? { trang_thai: value } : {}, { replace: true });

  return (
    <div className="lab-page">
      <div className="lab-toolbar">
        <div className="lab-tabs" role="tablist" aria-label="Lọc theo trạng thái">
          {FILTERS.map((f) => (
            <button
              key={f.value || "ALL"}
              type="button"
              role="tab"
              aria-selected={trangThai === f.value}
              className={`lab-tab${trangThai === f.value ? " lab-tab--active" : ""}`}
              onClick={() => changeFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {data?.room?.ten_phong && <p className="lab-room">{data.room.ten_phong}</p>}
      </div>

      {loading && (
        <div className="cp-state" role="status">
          <span className="cp-spinner" aria-hidden="true" />
          Đang tải danh sách chỉ định...
        </div>
      )}

      {!loading && error && (
        <div className="cp-state cp-state--error lab-state" role="alert">
          <p>{error.message || "Không tải được danh sách chỉ định."}</p>
          <button type="button" className="cp-btn cp-btn--primary" onClick={reload}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="cp-state">
          {trangThai
            ? `Không có chỉ định nào ở trạng thái "${statusLabel(trangThai)}".`
            : "Phòng chưa có chỉ định xét nghiệm nào."}
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="lab-table-wrap">
          <table className="lab-table">
            <thead>
              <tr>
                <th>Bệnh nhân</th>
                <th>Tên xét nghiệm</th>
                <th>Phòng</th>
                <th>Thời gian chỉ định</th>
                <th>Trạng thái</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.chi_dinh_id}>
                  <td className="lab-strong">{show(item.patient?.ho_ten)}</td>
                  <td>{show(item.ten_xet_nghiem)}</td>
                  <td>{show(item.room?.ten_phong)}</td>
                  <td className="lab-nowrap">{formatDateTime(item.thoi_gian_chi_dinh)}</td>
                  <td>
                    <span className={statusClass(item.trang_thai)}>
                      {statusLabel(item.trang_thai)}
                    </span>
                  </td>
                  <td className="lab-action">
                    <Link className="lab-link" to={`/lab/orders/${item.chi_dinh_id}`}>
                      Mở
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LabOrderListPage;