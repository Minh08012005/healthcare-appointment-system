import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BookingIcon from "../booking/BookingIcons";
import { formatDate, getInitials } from "../booking/bookingFormat";
import { historyApi } from "../../../api/patientHistory";
import { useFetch } from "../../../api/useFetch";
import { ErrorState, LoadingState } from "../appointments/StateMessage";
import { formatLabTime, getLabStatus } from "./historyHelpers";
import { HISTORY_PATHS } from "./historyPaths";
import "../booking/booking.css";
import "../appointments/appointments.css";
import "./history.css";

// Một mục trong "Kết quả khám": có nội dung thì hiện, không có thì hiện "Chưa ghi nhận"
function ResultBlock({ label, value }) {
  return (
    <div className="mh-block">
      <small>{label}</small>
      {value ? <p className="mh-block__text">{value}</p> : <p className="mh-block__empty">Chưa ghi nhận</p>}
    </div>
  );
}

// Mở file kết quả xét nghiệm. File cần Authorization nên tải về Blob rồi tạo blob URL để xem.
function LabFile({ file }) {
  const [opened, setOpened] = useState(null); // { url, type }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Thu hồi blob URL khi đóng file hoặc rời trang
  useEffect(
    () => () => {
      if (opened) URL.revokeObjectURL(opened.url);
    },
    [opened],
  );

  const openFile = async () => {
    setLoading(true);
    setError("");
    try {
      const blob = await historyApi.getLabFile(file.file_url);
      setOpened({ url: URL.createObjectURL(blob), type: blob.type || file.file_type || "" });
    } catch (err) {
      setError(err?.message || "Không mở được file kết quả.");
    } finally {
      setLoading(false);
    }
  };

  const isImage = opened?.type.startsWith("image/");
  const isPdf = opened?.type === "application/pdf";

  return (
    <div className="mh-file">
      {!opened && (
        <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={openFile} disabled={loading}>
          <BookingIcon name="download" size={14} />
          {loading ? "Đang tải file..." : "Xem file kết quả"}
        </button>
      )}
      {opened && (
        <>
          <div className="mh-file__bar">
            <a href={opened.url} target="_blank" rel="noopener noreferrer">
              Mở trong tab mới
            </a>
            <button type="button" onClick={() => setOpened(null)}>
              Đóng file
            </button>
          </div>
          {isImage && <img className="mh-file__preview" src={opened.url} alt="File kết quả xét nghiệm" />}
          {isPdf && (
            <iframe className="mh-file__preview mh-file__pdf" src={opened.url} title="File kết quả xét nghiệm" />
          )}
          {!isImage && !isPdf && (
            <p className="mh-block__empty">Không xem trước được định dạng này, hãy mở trong tab mới.</p>
          )}
        </>
      )}
      {error && (
        <div className="ap-notice ap-notice--error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

// C6-11 — Chi tiết một lần khám đã hoàn tất: thông tin lần khám, kết quả khám, kết quả xét nghiệm.
function MedicalHistoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useFetch(historyApi.detailPath(id));

  const goList = () => navigate(HISTORY_PATHS.list);
  // 404 (hồ sơ của người khác / chưa hoàn tất / không tồn tại) và 400 (mã sai) cùng hiển thị "không tìm thấy"
  const notFound = error?.status === 404 || error?.status === 400;
  const kq = data?.ket_qua_kham;
  const labs = Array.isArray(data?.xet_nghiem) ? data.xet_nghiem : [];

  return (
    <div className="ap-page ap-detail">
      <header className="ap-header ap-detail-header">
        <div className="ap-detail-header__left">
          <button type="button" className="ap-back" onClick={goList} aria-label="Quay lại lịch sử khám">
            ←
          </button>
          <div className="ap-detail-header__title">
            <h1>Chi tiết lần khám</h1>
            <p className="ap-header__sub">Kết quả khám và xét nghiệm của bạn</p>
          </div>
        </div>
        <button type="button" className="ap-btn ap-btn--ghost ap-btn--sm" onClick={goList}>
          Lịch sử khám
        </button>
      </header>

      <main className="ap-main">
        {loading && <LoadingState text="Đang tải chi tiết lần khám..." />}

        {!loading && error && notFound && (
          <div className="ap-state ap-state--error" role="alert">
            <h3>Không tìm thấy hồ sơ khám</h3>
            <p>Hồ sơ này không tồn tại hoặc không thuộc về bạn.</p>
            <div className="ap-state__actions">
              <button type="button" className="ap-btn ap-btn--primary" onClick={goList}>
                Về lịch sử khám
              </button>
            </div>
          </div>
        )}

        {!loading && error && !notFound && (
          <ErrorState error={error} onRetry={reload} onBack={goList} backLabel="Về lịch sử khám" />
        )}

        {!loading && !error && data && (
          <>
            {/* 1. Thông tin lần khám */}
            <section className="ap-card ap-info-card">
              <div className="ap-card-title">
                <BookingIcon name="calendar" size={18} />
                <strong>Thông tin lần khám</strong>
              </div>
              <div className="ap-doctor">
                <span className="ap-avatar">{getInitials(data.doctor?.ho_ten)}</span>
                <div>
                  <strong>BS. {data.doctor?.ho_ten || "—"}</strong>
                  <span>{data.doctor?.cap_bac || "Chưa cập nhật"}</span>
                </div>
              </div>
              <div className="ap-detail-rows">
                <div className="ap-detail-row">
                  <span className="ap-detail-row__label">Ngày khám</span>
                  <strong className="ap-detail-row__val">{formatDate(data.ho_so?.ngay_kham)}</strong>
                </div>
                <div className="ap-detail-row">
                  <span className="ap-detail-row__label">Bác sĩ</span>
                  <strong className="ap-detail-row__val">{data.doctor?.ho_ten || "Chưa cập nhật"}</strong>
                </div>
                <div className="ap-detail-row">
                  <span className="ap-detail-row__label">Chuyên khoa</span>
                  <strong className="ap-detail-row__val ap-blue">
                    {data.chuyen_khoa?.ten_chuyen_khoa || "Chưa cập nhật"}
                  </strong>
                </div>
              </div>
            </section>

            {/* 2. Kết quả khám */}
            <section className="ap-card ap-info-card">
              <div className="ap-card-title">
                <BookingIcon name="medical" size={18} />
                <strong>Kết quả khám</strong>
              </div>
              <ResultBlock label="TRIỆU CHỨNG" value={kq?.trieu_chung} />
              <ResultBlock label="CHẨN ĐOÁN" value={kq?.chan_doan} />
              <ResultBlock label="LỜI DẶN CỦA BÁC SĨ" value={kq?.loi_dan} />
              <ResultBlock label="ĐƠN THUỐC" value={kq?.don_thuoc} />
            </section>

            {/* 3. Kết quả xét nghiệm */}
            <section className="ap-card ap-info-card">
              <div className="ap-card-title">
                <BookingIcon name="clock" size={18} />
                <strong>Kết quả xét nghiệm</strong>
              </div>
              {labs.length === 0 ? (
                <div className="mh-empty">
                  <p>Lần khám này không có chỉ định xét nghiệm.</p>
                </div>
              ) : (
                <ul className="mh-labs">
                  {labs.map((lab) => {
                    const st = getLabStatus(lab.trang_thai);
                    return (
                      <li key={lab.id} className="mh-lab">
                        <div className="mh-lab__top">
                          <strong>{lab.ten_xet_nghiem}</strong>
                          <span className={`mh-pill mh-pill--${st.tone}`}>{st.label}</span>
                        </div>
                        {lab.trang_thai === "DA_XONG" && (
                          <small className="mh-lab__time">Hoàn thành lúc {formatLabTime(lab.thoi_gian_hoan_thanh)}</small>
                        )}
                        {lab.trang_thai === "DA_XONG" ? (
                          <>
                            <p className={lab.mo_ta ? "mh-block__text" : "mh-block__empty"}>
                              {lab.mo_ta || "Không có mô tả kết quả."}
                            </p>
                            {lab.file ? (
                              <LabFile file={lab.file} />
                            ) : (
                              <p className="mh-block__empty">Không có file đính kèm.</p>
                            )}
                          </>
                        ) : (
                          <p className="mh-block__empty">Chưa có kết quả.</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default MedicalHistoryDetailPage;
