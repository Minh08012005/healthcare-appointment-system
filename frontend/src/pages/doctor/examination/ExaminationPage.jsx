import { Fragment, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../../api/useFetch";
import { examinationApi, examinationPaths } from "../../../api/examination";
import ExamResultForm from "./ExamResultForm";
import LabOrderSection from "./LabOrderSection";
import "../call/callPatient.css"; // tái dùng cp-btn, cp-state, cp-spinner, cp-pill
import "./examination.css";

const STATUS_LABELS = {
  DANG_KHAM: "Đang khám",
  DA_XONG: "Đã xong",
};
const LANE_LABELS = { ONLINE: "Hàng online", OFFLINE: "Hàng offline" };

const statusText = (v) => STATUS_LABELS[v] || v || "—";
// "2026-11-08" -> "08/11/2026"
const formatDate = (v) => {
  if (typeof v !== "string" || v.length < 10) return "—";
  const [y, m, d] = v.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const formatTime = (v) => (typeof v === "string" && v.length >= 5 ? v.slice(0, 5) : null);
const show = (v) => (v === null || v === undefined || v === "" ? "—" : v);

const ERROR_TEXT = {
  400: "Mã hồ sơ không hợp lệ.",
  403: "Bạn không có quyền xem hồ sơ này.",
  404: "Không tìm thấy hồ sơ khám.",
};
const errorText = (err) =>
  ERROR_TEXT[err?.status] || err?.message || "Không tải được dữ liệu.";

function InfoList({ rows }) {
  return (
    <dl className="ex-info">
      {rows.map(([label, value]) => (
        <div key={label} className="ex-info__row">
          <dt>{label}</dt>
          <dd>{show(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function HistorySection({ hoSoId }) {
  const { data, loading, error, reload } = useFetch(examinationPaths.history(hoSoId));
  const [openId, setOpenId] = useState(null);
  const history = data?.history || [];

  return (
    <section className="ex-panel ex-panel--history">
      <div className="ex-panel__head">
        <h3 className="ex-panel__title">Lịch sử khám</h3>
      </div>

      {loading && (
        <div className="cp-state" role="status">
          <span className="cp-spinner" aria-hidden="true" />
          Đang tải lịch sử khám...
        </div>
      )}

      {!loading && error && (
        <div className="cp-state cp-state--error" role="alert">
          <p>{errorText(error)}</p>
          <button type="button" className="cp-btn cp-btn--outline" onClick={reload}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && history.length === 0 && (
        <div className="cp-state">Bệnh nhân chưa có lịch sử khám trước đó.</div>
      )}

      {!loading && !error && history.length > 0 && (
        <div className="ex-table-wrap">
          <table className="ex-table">
            <thead>
              <tr>
                <th>Ngày khám</th>
                <th>Bác sĩ</th>
                <th>Chẩn đoán</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const open = openId === item.ho_so_id;
                return (
                  <Fragment key={item.ho_so_id}>
                    <tr>
                      <td className="ex-table__date">{formatDate(item.ngay_kham)}</td>
                      <td>{show(item.doctor?.ho_ten)}</td>
                      <td>{show(item.chan_doan)}</td>
                      <td className="ex-table__action">
                        <button
                          type="button"
                          className="ex-link"
                          aria-expanded={open}
                          onClick={() => setOpenId(open ? null : item.ho_so_id)}
                        >
                          {open ? "Thu gọn" : "Xem"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="ex-table__detail">
                        <td colSpan={4}>
                          <InfoList
                            rows={[
                              ["Trạng thái", statusText(item.trang_thai)],
                              ["Triệu chứng", item.trieu_chung],
                              ["Chẩn đoán", item.chan_doan],
                              ["Lời dặn", item.loi_dan],
                              ["Đơn thuốc", item.don_thuoc],
                            ]}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ExaminationPage() {
  // hoSoId nằm trên URL -> F5 vẫn tải lại đúng hồ sơ từ Backend
  const { hoSoId } = useParams();
  const validId = /^\d+$/.test(hoSoId || "");
  const { data, loading, error, reload } = useFetch(
    validId ? examinationPaths.record(hoSoId) : null,
  );

  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState(null);
  const closingRef = useRef(false);

  if (!validId || (!loading && error)) {
    return (
      <div className="ex-page">
        <div className="cp-state cp-state--error ex-state" role="alert">
          <p>{validId ? errorText(error) : ERROR_TEXT[400]}</p>
          <div className="ex-state__actions">
            {validId && (
              <button type="button" className="cp-btn cp-btn--primary" onClick={reload}>
                Thử lại
              </button>
            )}
            <Link to="/doctor/call" className="cp-btn cp-btn--outline">
              Về Gọi bệnh nhân
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="ex-page">
        <div className="cp-state" role="status">
          <span className="cp-spinner" aria-hidden="true" />
          Đang tải hồ sơ khám...
        </div>
      </div>
    );
  }

  const { ho_so: hoSo, patient, queue, doctor, room, appointment } = data;
  const ketQua = data.ket_qua_kham;

  const handleClose = async () => {
    if (closingRef.current) return;
    if (
      !window.confirm(
        "Xác nhận hoàn thành và đóng hồ sơ khám bệnh?\nSau khi đóng, hồ sơ sẽ chuyển sang chế độ chỉ đọc và không thể chỉnh sửa kết quả hoặc tạo thêm chỉ định."
      )
    ) {
      return;
    }

    closingRef.current = true;
    setClosing(true);
    setCloseError(null);
    try {
      await examinationApi.close(hoSoId);
      reload();
    } catch (err) {
      if (err?.code === "LAB_ORDER_PENDING" || err?.status === 409) {
        setCloseError(
          err?.message || "Không thể đóng hồ sơ khi còn chỉ định xét nghiệm chưa hoàn thành."
        );
      } else if (err?.status === 403) {
        setCloseError("Bạn không có quyền đóng hồ sơ này.");
      } else {
        setCloseError(err?.message || "Không thể đóng hồ sơ. Vui lòng thử lại.");
      }
    } finally {
      closingRef.current = false;
      setClosing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const gioHen = formatTime(appointment?.gio_kham);
  const roomLabel = [room?.ten_phong, room?.ten_chuyen_khoa].filter(Boolean).join(" – ");
  const doctorName = doctor ? [doctor.cap_bac, doctor.ho_ten].filter(Boolean).join(" ") : "—";
  const trieuChungText = ketQua?.trieu_chung_ghi_nhan || appointment?.trieu_chung || "—";
  const chanDoanText = ketQua?.chan_doan || "—";
  const loiDanText = ketQua?.loi_dan || "—";
  const donThuocText = ketQua?.don_thuoc || "—";

  const subline = [
    queue?.nhan_stt && `STT ${queue.nhan_stt}`,
    LANE_LABELS[queue?.loai],
    roomLabel && `Phòng ${roomLabel}`,
    `Ngày ${formatDate(hoSo?.ngay_kham)}`,
    gioHen && `Giờ hẹn ${gioHen}`,
  ].filter(Boolean);

  return (
    <div className="ex-page" data-ho-so-id={hoSo?.id}>
      <header className="ex-header">
        <div className="ex-header__main">
          <div className="ex-header__name">
            <h1 className="ex-header__title">{show(patient?.ho_ten)}</h1>
            <span
              className={`ex-status-badge ${
                hoSo?.trang_thai === "DANG_KHAM"
                  ? "ex-status-badge--active"
                  : "ex-status-badge--closed"
              }`}
            >
              <span className="ex-status-dot" aria-hidden="true" />
              {statusText(hoSo?.trang_thai)}
            </span>
          </div>
          <p className="ex-header__sub">
            {subline.map((item, idx) => (
              <Fragment key={idx}>
                {idx > 0 && <span className="ex-sub-dot" aria-hidden="true">·</span>}
                <span>{item}</span>
              </Fragment>
            ))}
          </p>
        </div>
        <div className="ex-header__actions">
          {hoSo?.trang_thai === "DANG_KHAM" ? (
            <>
              <button
                type="button"
                className="cp-btn cp-btn--primary"
                onClick={handleClose}
                disabled={closing}
              >
                {closing ? "Đang đóng..." : "Đóng hồ sơ"}
              </button>
              <button
                type="button"
                className="cp-btn cp-btn--outline"
                onClick={handlePrint}
                disabled={closing}
              >
                In kết quả
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="cp-btn cp-btn--outline"
                onClick={handlePrint}
              >
                In kết quả
              </button>
              <Link to="/doctor/call" className="cp-btn cp-btn--primary">
                Về Gọi bệnh nhân
              </Link>
            </>
          )}
        </div>
      </header>

      {closeError && (
        <div className="cp-notice cp-notice--error" role="alert">
          <strong>Lỗi đóng hồ sơ:</strong> {closeError}
        </div>
      )}

      <div className="ex-grid">
        <aside className="ex-rail">
          <div className="ex-rail__section">
            <h3 className="ex-rail__heading">Bệnh nhân</h3>
            <InfoList
              rows={[
                ["Họ tên", patient?.ho_ten],
                ["Ngày sinh", patient?.ngay_sinh && formatDate(patient.ngay_sinh)],
                ["Giới tính", patient?.gioi_tinh],
                ["Số điện thoại", patient?.so_dien_thoai],
                ["Mã BHYT", patient?.ma_bhyt],
                ["Địa chỉ", patient?.dia_chi],
              ]}
            />
          </div>

          <div className="ex-rail__divider" />

          <div className="ex-rail__section">
            <h3 className="ex-rail__heading">Lượt khám</h3>
            <InfoList
              rows={[
                ["Mã hồ sơ", hoSo?.id],
                ["Trạng thái", statusText(hoSo?.trang_thai)],
                ["Bác sĩ", doctor && [doctor.cap_bac, doctor.ho_ten].filter(Boolean).join(" ")],
                ["Phòng", roomLabel],
                ["Mã đặt lịch", appointment?.ma_dat_lich],
              ]}
            />
          </div>
        </aside>

        <main className="ex-workspace">
          {/* Khu vực kết quả khám hiện tại (C4-05): nhập/lưu khi DANG_KHAM, còn lại chỉ xem */}
          <section className="ex-workspace__main" id="exam-result-area">
            <div className="ex-workspace__head">
              <div>
                <h2 className="ex-workspace__title">Kết quả khám lâm sàng</h2>
                <p className="ex-workspace__subtitle">
                  Chẩn đoán xác định, diễn biến lâm sàng và chỉ định điều trị
                </p>
              </div>
              <div className="ex-symptom-badge" title="Triệu chứng ban đầu khi đặt lịch">
                <span className="ex-symptom-badge__label">Lý do khám:</span>
                <span className="ex-symptom-badge__text">
                  {appointment?.trieu_chung || "Không có (bệnh nhân không khai khi đặt lịch)."}
                </span>
              </div>
            </div>

            {hoSo?.trang_thai === "DANG_KHAM" ? (
              <ExamResultForm key={hoSoId} hoSoId={hoSoId} ketQua={ketQua} onRecordStale={reload} />
            ) : (
              <div className="ex-readonly">
                <div className="cp-notice cp-notice--info">
                  Hồ sơ không còn ở trạng thái đang khám nên không thể chỉnh sửa kết quả khám.
                </div>
                {ketQua ? (
                  <div className="ex-readonly__grid">
                    <div className="ex-readonly__field">
                      <span className="ex-readonly__label">Triệu chứng ghi nhận</span>
                      <p className="ex-readonly__val">{show(ketQua.trieu_chung_ghi_nhan)}</p>
                    </div>
                    <div className="ex-readonly__field ex-readonly__field--diagnosis">
                      <span className="ex-readonly__label">Chẩn đoán xác định</span>
                      <p className="ex-readonly__val">{show(ketQua.chan_doan)}</p>
                    </div>
                    <div className="ex-readonly__field">
                      <span className="ex-readonly__label">Đơn thuốc</span>
                      <p className="ex-readonly__val ex-readonly__val--pre">{show(ketQua.don_thuoc)}</p>
                    </div>
                    <div className="ex-readonly__field">
                      <span className="ex-readonly__label">Lời dặn</span>
                      <p className="ex-readonly__val">{show(ketQua.loi_dan)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="ex-text ex-text--muted">Chưa có kết quả khám.</p>
                )}
              </div>
            )}
          </section>

          {/* Khu vực chỉ định xét nghiệm (C4-07) */}
          <LabOrderSection hoSoId={hoSoId} hoSoStatus={hoSo?.trang_thai} onRecordStale={reload} />

          <HistorySection hoSoId={hoSoId} />
        </main>
      </div>

      {/* Phiếu in kết quả khám (chỉ xuất hiện khi in qua window.print) */}
      <div className="ex-print-sheet" aria-hidden="true">
        <div className="ex-print__header">
          <div className="ex-print__hospital">
            <h2>PHÒNG KHÁM ĐA KHOA</h2>
            <p>{roomLabel ? `Phòng khám: ${roomLabel}` : "Hệ thống khám chữa bệnh"}</p>
          </div>
          <div className="ex-print__meta">
            <p><strong>Mã hồ sơ:</strong> #{hoSo?.id}</p>
            <p><strong>Ngày khám:</strong> {formatDate(hoSo?.ngay_kham)}</p>
          </div>
        </div>

        <h1 className="ex-print__title">PHIẾU KẾT QUẢ KHÁM BỆNH</h1>

        <section className="ex-print__section">
          <h3 className="ex-print__section-title">I. THÔNG TIN BỆNH NHÂN</h3>
          <table className="ex-print__table">
            <tbody>
              <tr>
                <td><strong>Họ và tên:</strong> {patient?.ho_ten || "—"}</td>
                <td><strong>Ngày sinh:</strong> {patient?.ngay_sinh ? formatDate(patient.ngay_sinh) : "—"}</td>
                <td><strong>Giới tính:</strong> {patient?.gioi_tinh || "—"}</td>
              </tr>
              <tr>
                <td><strong>Số điện thoại:</strong> {patient?.so_dien_thoai || "—"}</td>
                <td colSpan={2}><strong>Mã BHYT:</strong> {patient?.ma_bhyt || "—"}</td>
              </tr>
              <tr>
                <td colSpan={3}><strong>Địa chỉ:</strong> {patient?.dia_chi || "—"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="ex-print__section">
          <h3 className="ex-print__section-title">II. KẾT QUẢ KHÁM VÀ ĐIỀU TRỊ</h3>
          <div className="ex-print__field">
            <strong>Triệu chứng ghi nhận:</strong>
            <p>{trieuChungText}</p>
          </div>
          <div className="ex-print__field">
            <strong>Chẩn đoán:</strong>
            <p className="ex-print__highlight">{chanDoanText}</p>
          </div>
          <div className="ex-print__field">
            <strong>Lời dặn của bác sĩ:</strong>
            <p>{loiDanText}</p>
          </div>
          <div className="ex-print__field">
            <strong>Đơn thuốc:</strong>
            <p className="ex-print__pre">{donThuocText}</p>
          </div>
        </section>

        <div className="ex-print__footer">
          <div className="ex-print__sign">
            <p><em>Ngày {formatDate(hoSo?.ngay_kham)}</em></p>
            <p><strong>Bác sĩ khám bệnh</strong></p>
            <div className="ex-print__sign-space" />
            <p><strong>{doctorName}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExaminationPage;