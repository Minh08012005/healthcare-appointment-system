import { useRef, useState } from "react";
import { useFetch } from "../../../api/useFetch";
import { labOrderApi, labOrderPaths } from "../../../api/labOrders";
import "../call/callPatient.css"; // tái dùng cp-btn, cp-state, cp-spinner, cp-pill, cp-notice
import "./labOrder.css";

const HS_DANG_KHAM = "DANG_KHAM";
const MAX_TEN = 255;

const CD_LABELS = { CHO_XU_LY: "Chờ xử lý", DANG_XU_LY: "Đang xử lý", DA_XONG: "Đã xong" };
const CD_PILL = {
  CHO_XU_LY: "lo-pill--wait",
  DANG_XU_LY: "lo-pill--doing",
  DA_XONG: "lo-pill--done",
};

// "Phòng Xét nghiệm" / "xet nghiem" -> "xet nghiem" (bỏ dấu, chữ thường)
const normalize = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const isLabRoom = (room) => normalize(room.loai_phong).includes("xet nghiem");

const formatDateTime = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const createErrorText = (err) => {
  if (err?.status === 403) return "Bạn không có quyền tạo chỉ định cho hồ sơ này.";
  if (err?.status === 404) return "Không tìm thấy hồ sơ khám.";
  return err?.message || "Không tạo được chỉ định. Vui lòng thử lại.";
};

// C4-07: Chỉ định xét nghiệm trên Examination Page.
// hoSoId lấy từ URL -> F5 vẫn tải lại danh sách từ Backend (không giữ state tạm).
function LabOrderSection({ hoSoId, hoSoStatus, onRecordStale }) {
  const canCreate = hoSoStatus === HS_DANG_KHAM;

  const list = useFetch(labOrderPaths.list(hoSoId));
  const rooms = useFetch(canCreate ? labOrderPaths.rooms() : null);

  const [ten, setTen] = useState("");
  const [ghiChu, setGhiChu] = useState("");
  const [phongId, setPhongId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null); // { type: "success" | "error", text }
  const submittingRef = useRef(false); // khóa chống bấm đúp (đồng bộ, không chờ render)

  const allRooms = Array.isArray(rooms.data) ? rooms.data : [];
  const labRooms = allRooms.filter(isLabRoom);
  // Chưa có phòng nào mang loại "xét nghiệm" -> hiển thị tất cả phòng để vẫn chọn được
  const usingFallback = allRooms.length > 0 && labRooms.length === 0;
  const roomOptions = usingFallback ? allRooms : labRooms;
  const items = list.data?.chi_dinh || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;

    const tenTrim = ten.trim();
    if (!tenTrim) return setMessage({ type: "error", text: "Vui lòng nhập tên xét nghiệm." });
    if (!phongId) return setMessage({ type: "error", text: "Vui lòng chọn phòng xét nghiệm." });

    submittingRef.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      await labOrderApi.create({
        ho_so_id: Number(hoSoId),
        phong_kham_id: Number(phongId),
        ten_xet_nghiem: tenTrim,
        ghi_chu: ghiChu.trim() || undefined,
      });
      setTen("");
      setGhiChu("");
      setMessage({ type: "success", text: "Đã tạo chỉ định xét nghiệm." });
      list.reload(); // đọc lại từ Backend để danh sách luôn khớp dữ liệu thật
    } catch (err) {
      setMessage({ type: "error", text: createErrorText(err) });
      // Hồ sơ không còn DANG_KHAM (đã đóng ở nơi khác): tải lại hồ sơ để form tự ẩn
      if (err?.status === 409 && onRecordStale) onRecordStale();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="ex-card" id="lab-order-area">
      <h3 className="ex-card__title">
        Chỉ định xét nghiệm
        {!list.loading && !list.error && <span className="lo-count">{items.length}</span>}
      </h3>

      {canCreate ? (
        <form className="lo-form" onSubmit={handleSubmit} noValidate>
          <div className="lo-field">
            <label htmlFor="lo-ten">Tên xét nghiệm</label>
            <input
              id="lo-ten"
              type="text"
              value={ten}
              maxLength={MAX_TEN}
              placeholder="Ví dụ: Công thức máu"
              disabled={submitting}
              onChange={(e) => setTen(e.target.value)}
            />
          </div>

          <div className="lo-field">
            <label htmlFor="lo-phong">Phòng xét nghiệm</label>
            {rooms.loading && (
              <div className="lo-inline" role="status">
                <span className="cp-spinner" aria-hidden="true" /> Đang tải danh sách phòng...
              </div>
            )}
            {!rooms.loading && rooms.error && (
              <div className="lo-inline lo-inline--error" role="alert">
                Không tải được danh sách phòng.
                <button type="button" className="ex-link" onClick={rooms.reload}>
                  Thử lại
                </button>
              </div>
            )}
            {!rooms.loading && !rooms.error && (
              <>
                <select
                  id="lo-phong"
                  value={phongId}
                  disabled={submitting || roomOptions.length === 0}
                  onChange={(e) => setPhongId(e.target.value)}
                >
                  <option value="">— Chọn phòng —</option>
                  {roomOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.ten_phong}
                    </option>
                  ))}
                </select>
                {usingFallback && (
                  <small className="lo-hint">
                    Hệ thống chưa có phòng được đánh dấu là phòng xét nghiệm, đang hiển thị tất cả phòng.
                  </small>
                )}
                {roomOptions.length === 0 && <small className="lo-hint">Chưa có phòng nào để chọn.</small>}
              </>
            )}
          </div>

          <div className="lo-field">
            <label htmlFor="lo-ghichu">Ghi chú (không bắt buộc)</label>
            <textarea
              id="lo-ghichu"
              rows={2}
              value={ghiChu}
              placeholder="Ví dụ: Nhịn ăn sáng"
              disabled={submitting}
              onChange={(e) => setGhiChu(e.target.value)}
            />
          </div>

          {message && (
            <div
              className={`cp-notice ${message.type === "success" ? "cp-notice--success" : "cp-notice--error"}`}
              role={message.type === "success" ? "status" : "alert"}
            >
              {message.text}
            </div>
          )}

          <div className="lo-actions">
            <button
              type="submit"
              className="cp-btn cp-btn--primary"
              disabled={submitting || rooms.loading || !!rooms.error}
            >
              {submitting ? "Đang tạo..." : "Tạo chỉ định"}
            </button>
          </div>
        </form>
      ) : (
        <div className="cp-notice cp-notice--info">
          Hồ sơ không còn ở trạng thái đang khám nên không thể tạo chỉ định mới. Bạn vẫn xem được các chỉ định đã tạo.
        </div>
      )}

      <h4 className="lo-subtitle">Các chỉ định đã tạo</h4>

      {list.loading && (
        <div className="cp-state" role="status">
          <span className="cp-spinner" aria-hidden="true" />
          Đang tải chỉ định xét nghiệm...
        </div>
      )}

      {!list.loading && list.error && (
        <div className="cp-state cp-state--error" role="alert">
          <p>{list.error.message || "Không tải được danh sách chỉ định."}</p>
          <button type="button" className="cp-btn cp-btn--outline" onClick={list.reload}>
            Thử lại
          </button>
        </div>
      )}

      {!list.loading && !list.error && items.length === 0 && (
        <div className="cp-state">Hồ sơ này chưa có chỉ định xét nghiệm nào.</div>
      )}

      {!list.loading && !list.error && items.length > 0 && (
        <div className="ex-table-wrap">
          <table className="ex-table">
            <thead>
              <tr>
                <th>Xét nghiệm</th>
                <th>Phòng</th>
                <th>Ghi chú</th>
                <th>Trạng thái</th>
                <th>Thời gian chỉ định</th>
              </tr>
            </thead>
            <tbody>
              {items.map((cd) => (
                <tr key={cd.id}>
                  <td className="lo-name">{cd.ten_xet_nghiem}</td>
                  <td>{cd.phong?.ten_phong || "—"}</td>
                  <td className="lo-note">{cd.ghi_chu || "—"}</td>
                  <td>
                    <span className={`cp-pill ${CD_PILL[cd.trang_thai] || "lo-pill--wait"}`}>
                      {CD_LABELS[cd.trang_thai] || cd.trang_thai}
                    </span>
                  </td>
                  <td className="lo-time">{formatDateTime(cd.thoi_gian_chi_dinh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default LabOrderSection;
