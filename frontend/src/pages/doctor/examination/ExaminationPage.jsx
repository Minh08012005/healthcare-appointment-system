import { Fragment, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useFetch } from "../../../api/useFetch";
import { examinationPaths } from "../../../api/examination";
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
    <section className="ex-section">
      <h3 className="ex-section__title">Lịch sử khám</h3>

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
  const gioHen = formatTime(appointment?.gio_kham);
  const roomLabel = [room?.ten_phong, room?.ten_chuyen_khoa].filter(Boolean).join(" – ");
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
            <h1>{show(patient?.ho_ten)}</h1>
            <span
              className={`cp-pill ${hoSo?.trang_thai === "DANG_KHAM" ? "cp-pill--calling" : "ex-pill--muted"}`}
            >
              {statusText(hoSo?.trang_thai)}
            </span>
          </div>
          <p className="ex-header__sub">{subline.join(" · ")}</p>
        </div>
        {/* Slot nút thao tác: C4-05 / C4-07 tự thêm nút vào đây */}
        <div className="ex-header__actions" />
      </header>

      <div className="ex-grid">
        <div className="ex-col">
          <section className="ex-card">
            <h3 className="ex-card__title">Thông tin cá nhân</h3>
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
          </section>

          <section className="ex-card">
            <h3 className="ex-card__title">Thông tin lượt khám</h3>
            <InfoList
              rows={[
                ["Mã hồ sơ", hoSo?.id],
                ["Trạng thái", statusText(hoSo?.trang_thai)],
                ["Bác sĩ", doctor && [doctor.cap_bac, doctor.ho_ten].filter(Boolean).join(" ")],
                ["Phòng", roomLabel],
                ["Mã đặt lịch", appointment?.ma_dat_lich],
              ]}
            />
          </section>
        </div>

        <div className="ex-col">
          <section className="ex-card">
            <h3 className="ex-card__title">Triệu chứng ban đầu</h3>
            <p className="ex-text">
              {appointment?.trieu_chung || "Không có (bệnh nhân không khai khi đặt lịch)."}
            </p>
          </section>

          {/* Khu vực kết quả khám hiện tại — C4-05 gắn form nhập/lưu tại đây */}
          <section className="ex-card" id="exam-result-area">
            <h3 className="ex-card__title">Kết quả khám hiện tại</h3>
            {ketQua ? (
              <InfoList
                rows={[
                  ["Triệu chứng", ketQua.trieu_chung_ghi_nhan],
                  ["Chẩn đoán", ketQua.chan_doan],
                  ["Lời dặn", ketQua.loi_dan],
                  ["Đơn thuốc", ketQua.don_thuoc],
                ]}
              />
            ) : (
              <p className="ex-text ex-text--muted">Chưa có kết quả khám.</p>
            )}
          </section>

          {/* Khu vực chỉ định xét nghiệm — C4-07 gắn tại đây */}
          <div id="lab-order-area" />

          <HistorySection hoSoId={hoSoId} />
        </div>
      </div>
    </div>
  );
}

export default ExaminationPage;