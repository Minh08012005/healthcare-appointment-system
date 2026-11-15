import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../api/useFetch";
import { labRoomApi, labRoomPaths } from "../../api/labRoom";
import { formatDate, formatDateTime, show, statusClass, statusLabel } from "./labHelpers";
import "../doctor/call/callPatient.css"; // tái dùng cp-btn, cp-state, cp-spinner, cp-notice
import "./lab.css";

const HO_SO_STATUS = { DANG_KHAM: "Đang khám", DA_XONG: "Đã xong" };
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const MAX_MO_TA = 10000;

const STAGES = [
  { key: "CHO_XU_LY", label: "Chờ xử lý" },
  { key: "DANG_XU_LY", label: "Đang xử lý" },
  { key: "DA_XONG", label: "Đã xong" },
];

function InfoList({ rows }) {
  return (
    <dl className="lab-info">
      {rows.map(([label, value]) => (
        <div key={label} className="lab-info__row">
          <dt>{label}</dt>
          <dd>{show(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

// DANG_XU_LY: chọn file + mô tả -> POST multipart (C5-03)
function UploadForm({ id, onDone, onStale }) {
  const [file, setFile] = useState(null);
  const [moTa, setMoTa] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const busyRef = useRef(false); // chặn double submit

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busyRef.current || !file) return;
    busyRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await labRoomApi.submitResult(id, file, moTa);
      onDone();
    } catch (err) {
      // Hiển thị đúng message Backend (400/413/415...), không đổi trạng thái giả
      const message = err?.message || "Không tải được kết quả lên.";
      // 409: trạng thái đã đổi (chưa start / đã DA_XONG) -> báo ở trang và đồng bộ lại
      if (err?.status === 409) onStale(message);
      else setError(message);
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form className="lab-card lab-card--workspace" onSubmit={handleSubmit}>
      <div className="lab-card__header">
        <h3 className="lab-card__title">Tải kết quả xét nghiệm</h3>
        <p className="lab-card__subtitle">
          Đính kèm file kết quả và ghi nhận mô tả chuyên môn để hoàn tất chỉ định xét nghiệm
        </p>
      </div>

      <div className="lab-field">
        <label htmlFor="lab-file-input">
          File kết quả (PDF, JPG, PNG, WebP · tối đa 10MB)
        </label>
        <div className="lab-file-input-wrapper">
          <input
            id="lab-file-input"
            type="file"
            accept={ACCEPT}
            disabled={submitting}
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setError(null);
            }}
          />
          {file && (
            <div className="lab-file-chosen">
              <span className="lab-file-chosen__name">{file.name}</span>
              <span className="lab-file-chosen__size">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>
      </div>

      <div className="lab-field">
        <label htmlFor="lab-mota-input">Mô tả kết quả (tùy chọn)</label>
        <textarea
          id="lab-mota-input"
          rows={4}
          maxLength={MAX_MO_TA}
          value={moTa}
          disabled={submitting}
          onChange={(e) => setMoTa(e.target.value)}
          placeholder="Nhập mô tả kết luận, nhận định chuyên môn hoặc ghi chú xét nghiệm..."
        />
      </div>

      {error && (
        <div className="cp-notice cp-notice--error" role="alert">
          <strong>Không tải được kết quả</strong>
          <p>{error}</p>
        </div>
      )}

      <div className="lab-actions">
        <button type="submit" className="cp-btn cp-btn--primary" disabled={!file || submitting}>
          {submitting ? "Đang tải lên..." : "Tải lên và hoàn tất"}
        </button>
      </div>
    </form>
  );
}

// DA_XONG: chỉ xem kết quả (C5-03 GET result + file)
function ResultView({ id }) {
  const { data, loading, error, reload } = useFetch(labRoomPaths.result(id));
  const ketQua = data?.ket_qua;
  const [file, setFile] = useState({ key: null, url: null, error: null });
  const [fileReload, setFileReload] = useState(0);
  const fileKey = ketQua?.file_url ? `${id}#${fileReload}` : null;

  // File cần Authorization -> tải Blob qua apiClient rồi tạo blob URL
  useEffect(() => {
    if (!fileKey) return undefined;
    let cancelled = false;
    let url = null;
    labRoomApi
      .getResultFile(id)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (cancelled) URL.revokeObjectURL(url);
        else setFile({ key: fileKey, url, error: null });
      })
      .catch((err) => {
        if (!cancelled) setFile({ key: fileKey, url: null, error: err });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, fileKey]);

  const fileDone = fileKey !== null && file.key === fileKey;
  const isImage = ketQua?.file_type?.startsWith("image/");

  return (
    <section className="lab-card lab-card--result">
      <div className="lab-card__header">
        <div className="lab-result-badge-row">
          <h3 className="lab-card__title">Kết quả xét nghiệm</h3>
          <span className="lab-result-completed-tag">
            <span className="lab-result-completed-dot" aria-hidden="true" />
            Đã hoàn thành
          </span>
        </div>
        <p className="lab-card__subtitle">
          Chỉ định đã hoàn tất và kết quả đã sẵn sàng cho Bác sĩ điều trị xem
        </p>
      </div>

      {loading && (
        <div className="cp-state" role="status">
          <span className="cp-spinner" aria-hidden="true" />
          Đang tải kết quả...
        </div>
      )}

      {!loading && error && (
        <div className="cp-state cp-state--error lab-state" role="alert">
          <p>{error.message || "Không tải được kết quả."}</p>
          <button type="button" className="cp-btn cp-btn--outline" onClick={reload}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="lab-result-content">
          <InfoList
            rows={[
              ["Hoàn thành lúc", formatDateTime(data?.chi_dinh?.thoi_gian_hoan_thanh)],
              ["Mô tả", ketQua?.mo_ta || "Không có mô tả kết quả."],
            ]}
          />

          {!ketQua?.file_url && <p className="lab-muted">Chưa có file kết quả.</p>}

          {fileKey && !fileDone && (
            <div className="cp-state" role="status">
              <span className="cp-spinner" aria-hidden="true" />
              Đang tải file kết quả...
            </div>
          )}

          {fileDone && file.error && (
            <div className="cp-state cp-state--error lab-state" role="alert">
              <p>{file.error.message || "Không tải được file kết quả."}</p>
              <button
                type="button"
                className="cp-btn cp-btn--outline"
                onClick={() => setFileReload((n) => n + 1)}
              >
                Thử lại
              </button>
            </div>
          )}

          {fileDone && file.url && (
            <div className="lab-file">
              <div className="lab-file__bar">
                <span className="lab-file__title">File kết quả:</span>
                <a className="lab-link" href={file.url} target="_blank" rel="noreferrer">
                  Mở file kết quả trong tab mới
                </a>
              </div>
              {isImage ? (
                <img className="lab-file__preview" src={file.url} alt="File kết quả xét nghiệm" />
              ) : (
                <iframe
                  className="lab-file__preview lab-file__pdf"
                  src={file.url}
                  title="File kết quả xét nghiệm"
                />
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LabOrderDetailPage() {
  // id trên URL -> F5 luôn đọc lại trạng thái thật từ Backend
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(labRoomPaths.detail(id));
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState(null); // { type, title, text }
  const busyRef = useRef(false); // chặn double click "Bắt đầu xử lý"

  const handleStart = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStarting(true);
    setNotice(null);
    try {
      await labRoomApi.start(id);
      setNotice({ type: "success", title: "Đã bắt đầu xử lý" });
      reload(); // lấy lại trạng thái DANG_XU_LY từ Backend
    } catch (err) {
      setNotice({
        type: "error",
        title: "Không bắt đầu xử lý được",
        text: err?.message || "Đã có lỗi xảy ra, vui lòng thử lại.",
      });
      if (err?.status === 409) reload(); // trạng thái đã đổi ở nơi khác -> đồng bộ lại
    } finally {
      busyRef.current = false;
      setStarting(false);
    }
  };

  const handleUploaded = () => {
    setNotice({ type: "success", title: "Đã nộp kết quả và hoàn tất xét nghiệm" });
    reload();
  };

  const handleUploadStale = (message) => {
    setNotice({ type: "error", title: "Không tải được kết quả", text: message });
    reload();
  };

  const backLink = (
    <Link to="/lab" className="cp-btn cp-btn--outline">
      Về danh sách
    </Link>
  );

  return (
    <div className="lab-page">
      {notice && (
        <div
          className={`cp-notice cp-notice--${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          <strong>{notice.title}</strong>
          {notice.text && <p>{notice.text}</p>}
        </div>
      )}

      {loading && (
        <div className="cp-state" role="status">
          <span className="cp-spinner" aria-hidden="true" />
          Đang tải chi tiết chỉ định...
        </div>
      )}

      {!loading && error && (
        <div className="cp-state cp-state--error lab-state" role="alert">
          <p>{error.message || "Không tải được chi tiết chỉ định."}</p>
          <div className="lab-actions">
            <button type="button" className="cp-btn cp-btn--primary" onClick={reload}>
              Thử lại
            </button>
            {backLink}
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <header className="lab-header">
            <div className="lab-header__main">
              <div className="lab-header__title-row">
                <h1 className="lab-header__title">
                  {show(data.patient?.ho_ten)} · {show(data.ten_xet_nghiem)}
                </h1>
                <span className={statusClass(data.trang_thai)}>
                  <span className="lab-pill-dot" aria-hidden="true" />
                  {statusLabel(data.trang_thai)}
                </span>
              </div>
              <p className="lab-header__sub">
                Chi tiết chỉ định xét nghiệm và quy trình xử lý kết quả
              </p>
            </div>
            {backLink}
          </header>

          <div className="lab-stepper" aria-label="Tiến trình xét nghiệm">
            {STAGES.map((s, idx) => {
              const isCurrent = data.trang_thai === s.key;
              const isDone =
                (data.trang_thai === "DANG_XU_LY" && idx === 0) ||
                data.trang_thai === "DA_XONG";
              let stepClass = "lab-step--pending";
              if (isCurrent) {
                stepClass = `lab-step--active lab-step--${s.key.toLowerCase()}`;
              } else if (isDone) {
                stepClass = "lab-step--done";
              }

              return (
                <div key={s.key} className={`lab-step ${stepClass}`}>
                  <span className="lab-step__dot" aria-hidden="true" />
                  <span className="lab-step__label">{s.label}</span>
                </div>
              );
            })}
          </div>

          <div className="lab-grid">
            <section className="lab-card">
              <div className="lab-card__header">
                <h3 className="lab-card__title">Bệnh nhân và hồ sơ</h3>
              </div>
              <InfoList
                rows={[
                  ["Họ tên", data.patient?.ho_ten],
                  ["Ngày sinh", data.patient?.ngay_sinh && formatDate(data.patient.ngay_sinh)],
                  ["Giới tính", data.patient?.gioi_tinh],
                  ["Mã hồ sơ", data.ho_so?.id ?? data.ho_so_id],
                  ["Ngày khám", data.ho_so?.ngay_kham && formatDate(data.ho_so.ngay_kham)],
                  ["Trạng thái hồ sơ", HO_SO_STATUS[data.ho_so?.trang_thai] || data.ho_so?.trang_thai],
                ]}
              />
            </section>

            <section className="lab-card">
              <div className="lab-card__header">
                <h3 className="lab-card__title">Chỉ định xét nghiệm</h3>
              </div>
              <InfoList
                rows={[
                  ["Tên xét nghiệm", data.ten_xet_nghiem],
                  ["Phòng", data.room?.ten_phong],
                  ["Bác sĩ chỉ định", data.doctor?.ho_ten],
                  ["Thời gian chỉ định", formatDateTime(data.thoi_gian_chi_dinh)],
                  ["Ghi chú bác sĩ", data.ghi_chu],
                  ["Trạng thái", statusLabel(data.trang_thai)],
                  ["Người xử lý", data.xu_ly?.nhan_vien?.ten_dang_nhap],
                  [
                    "Bắt đầu xử lý",
                    data.xu_ly?.thoi_gian_bat_dau && formatDateTime(data.xu_ly.thoi_gian_bat_dau),
                  ],
                ]}
              />
            </section>
          </div>

          {data.trang_thai === "CHO_XU_LY" && (
            <section className="lab-panel lab-panel--action">
              <div className="lab-panel__body">
                <div>
                  <h3 className="lab-panel__title">Tiếp nhận chỉ định xét nghiệm</h3>
                  <p className="lab-panel__desc">
                    Chỉ định đang ở trạng thái chờ xử lý. Nhấn nút để bắt đầu thực hiện xét nghiệm và chuyển sang trạng thái đang xử lý.
                  </p>
                </div>
                <button
                  type="button"
                  className="cp-btn cp-btn--primary"
                  onClick={handleStart}
                  disabled={starting}
                >
                  {starting ? "Đang xử lý..." : "Bắt đầu xử lý"}
                </button>
              </div>
            </section>
          )}

          {data.trang_thai === "DANG_XU_LY" && (
            <UploadForm id={id} onDone={handleUploaded} onStale={handleUploadStale} />
          )}

          {data.trang_thai === "DA_XONG" && <ResultView id={id} />}
        </>
      )}
    </div>
  );
}

export default LabOrderDetailPage;
