import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import BookingIcon from "../booking/BookingIcons";
import { BOOKING_PATHS } from "../booking/bookingPaths";
import { formatDate, formatFee, formatTime, getInitials } from "../booking/bookingFormat";
import { appointmentApi } from "../../../api/appointments";
import { useFetch } from "../../../api/useFetch";
import ConfirmCancelModal from "./ConfirmCancelModal";
import { ErrorState, LoadingState } from "./StateMessage";
import { getStatusKey, getStatusLabel } from "./appointmentHelpers";
import "../booking/booking.css";
import "./appointments.css";

// BN15 — Chi tiết lịch hẹn + QR + Hủy lịch (API C2-08A: GET :id, PATCH :id/cancel)
function AppointmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qrRef = useRef(null);
  const submittingRef = useRef(false); // khóa chống double-click (đồng bộ, không chờ render)

  const { data, error, loading, reload } = useFetch(appointmentApi.detailPath(id));
  const [cancelledStatus, setCancelledStatus] = useState(null); // trạng thái xác nhận từ API trong phiên này
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [notice, setNotice] = useState(null); // { type: "success" | "error", text }
  const [copied, setCopied] = useState(false);

  const goList = () => navigate(BOOKING_PATHS.appointments);

  // Sau khi hủy: cập nhật ngay UI theo kết quả backend (Đã hủy, QR mất hiệu lực)
  const appointment = data
    ? cancelledStatus
      ? { ...data, trang_thai: cancelledStatus, qr_code: null, co_the_huy: false }
      : data
    : null;

  const openModal = () => {
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submittingRef.current) return;
    setModalOpen(false);
  };

  const handleCancel = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setModalError("");
    try {
      const response = await appointmentApi.cancel(id);
      if (response?.success !== true || response?.data?.trang_thai !== "DA_HUY") {
        throw new Error(response?.message || "Backend chưa xác nhận hủy lịch hẹn. Vui lòng tải lại và thử lại.");
      }
      setCancelledStatus(response.data.trang_thai);
      setModalOpen(false);
      setNotice({ type: "success", text: "Đã hủy lịch hẹn thành công. Mã QR không còn hợp lệ." });
    } catch (err) {
      if (err?.status === 400 || err?.status === 404 || err?.status === 409) {
        // Quá hạn hủy / đã hủy trước đó / không tồn tại: báo lỗi và tải lại trạng thái thật
        setModalOpen(false);
        setNotice({ type: "error", text: err.message });
        reload();
      } else {
        setModalError(err?.message || "Không hủy được lịch hẹn. Vui lòng thử lại.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleSaveQr = () => {
    const canvas = qrRef.current;
    if (!canvas || !appointment) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${appointment.ma_dat_lich}.png`;
    link.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appointment.ma_dat_lich);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // trình duyệt chặn clipboard -> bỏ qua
    }
  };

  const statusKey = appointment ? getStatusKey(appointment) : "other";

  return (
    <div className="ap-page ap-detail">
      <header className="ap-page-header ap-detail-page-header">
        <div className="ap-page-header__main">
          <div className="ap-detail-back-row">
            <button
              type="button"
              className="ap-back-btn"
              onClick={goList}
              aria-label="Quay lại danh sách lịch hẹn"
            >
              <BookingIcon name="arrowLeft" size={15} />
              <span>Danh sách lịch hẹn</span>
            </button>
          </div>
          <span className="ap-kicker">LỊCH HẸN KHÁM BỆNH</span>
          <h1 className="ap-page-title">Chi tiết lịch hẹn</h1>
          <p className="ap-page-desc">
            Thông tin chi tiết lượt khám và mã QR check-in tại quầy tiếp đón MEDICARE.
          </p>
        </div>
      </header>

      <main className="ap-main">
        {loading && <LoadingState text="Đang tải chi tiết lịch hẹn..." />}

        {!loading && error && (
          <ErrorState
            error={error}
            onRetry={reload}
            onBack={goList}
            backLabel="Về danh sách lịch hẹn"
          />
        )}

        {!loading && !error && appointment && (
          <>
            {notice && (
              <div className={`ap-notice ap-notice--${notice.type}`} role="status">
                {notice.text}
              </div>
            )}

            <div className="ap-detail-grid">
              {/* Cột chính: Thông tin khám bệnh */}
              <div className="ap-detail-main-col">
                <section className="ap-card ap-info-card">
                  <div className="ap-card-title">
                    <BookingIcon name="medical" size={18} />
                    <strong>Thông tin khám bệnh</strong>
                  </div>

                  <div className="ap-doctor">
                    <span className="ap-avatar">{getInitials(appointment.bac_si_ten)}</span>
                    <div>
                      <strong>BS. {appointment.bac_si_ten || "—"}</strong>
                      <span>
                        {[
                          appointment.cap_bac,
                          appointment.ten_chuyen_khoa &&
                            `Chuyên khoa: ${appointment.ten_chuyen_khoa}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Chưa cập nhật"}
                      </span>
                    </div>
                  </div>

                  <div className="ap-detail-rows">
                    <div className="ap-detail-row">
                      <span className="ap-detail-row__label">Chuyên khoa</span>
                      <strong className="ap-detail-row__val">
                        {appointment.ten_chuyen_khoa || "Chưa cập nhật"}
                      </strong>
                    </div>
                    <div className="ap-detail-row">
                      <span className="ap-detail-row__label">Phòng khám</span>
                      <strong className="ap-detail-row__val ap-blue">
                        {appointment.ten_phong || "Chưa cập nhật"}
                      </strong>
                    </div>
                    <div className="ap-detail-row">
                      <span className="ap-detail-row__label">Thời gian khám</span>
                      <div className="ap-detail-row__time">
                        <strong className="ap-detail-row__val">
                          {formatTime(appointment.gio_kham)}
                        </strong>
                        <span className="ap-detail-row__date">
                          {formatDate(appointment.ngay_kham)}
                        </span>
                      </div>
                    </div>
                    <div className="ap-detail-row">
                      <span className="ap-detail-row__label">Phí khám</span>
                      <strong className="ap-detail-row__val ap-detail-row__val--fee">
                        {formatFee(appointment.phi_kham)}
                      </strong>
                    </div>
                  </div>

                  {appointment.trieu_chung && (
                    <div className="ap-symptom">
                      <small>TRIỆU CHỨNG BAN ĐẦU</small>
                      <p>{appointment.trieu_chung}</p>
                    </div>
                  )}
                </section>

                <div className="ap-help">
                  <span className="ap-help__icon">
                    <BookingIcon name="info" size={20} />
                  </span>
                  <div>
                    <strong>Lưu ý tiếp đón tại bệnh viện</strong>
                    <p>
                      {statusKey === "checkedIn"
                        ? "Bạn đã hoàn tất tiếp đón. Vui lòng theo dõi thông báo số thứ tự tại khu vực chờ của phòng khám."
                        : "Vui lòng đến trước giờ hẹn tối thiểu 10 phút, nếu không mã QR tiếp đón sẽ hết hiệu lực phục vụ."}
                    </p>
                  </div>
                </div>

                {statusKey === "cancelled" ? (
                  <div className="ap-cancel-banner">
                    <BookingIcon name="info" size={15} />
                    <span>Lịch hẹn này đã được hủy.</span>
                  </div>
                ) : (
                  <div className="ap-cancel-zone">
                    <p className="ap-cancel-hint">
                      <BookingIcon name="info" size={13} />
                      <span>
                        {appointment.co_the_huy
                          ? "Chỉ được phép hủy lịch hẹn trước giờ khám ít nhất 2 tiếng."
                          : statusKey === "checkedIn"
                          ? "Lịch hẹn đã check-in không thể hủy."
                          : "Đã quá thời hạn hủy (cần hủy trước giờ khám ít nhất 2 tiếng)."}
                      </span>
                    </p>
                    <button
                      type="button"
                      className="ap-btn ap-btn--danger-outline"
                      onClick={openModal}
                      disabled={!appointment.co_the_huy}
                    >
                      <BookingIcon name="x" size={16} />
                      Hủy lịch hẹn
                    </button>
                  </div>
                )}
              </div>

              {/* Cột phụ: Thẻ QR Check-in */}
              <div className="ap-detail-side-col">
                <section className="ap-card ap-qr-card">
                  <div className="ap-qr-card__top">
                    <span className={`ap-badge ap-badge--${statusKey}`}>
                      {getStatusLabel(appointment)}
                    </span>
                    <button
                      type="button"
                      className="ap-code"
                      onClick={handleCopy}
                      aria-label="Sao chép mã lịch hẹn"
                      title="Nhấn để sao chép"
                    >
                      Mã: <strong>{appointment.ma_dat_lich}</strong>
                      <BookingIcon name={copied ? "check" : "copy"} size={13} />
                    </button>
                  </div>

                  {appointment.qr_code ? (
                    <>
                      <div className="bk-qr-box">
                        <QRCodeCanvas
                          ref={qrRef}
                          value={appointment.qr_code}
                          size={170}
                          level="M"
                          fgColor="#000000"
                          bgColor="#ffffff"
                          marginSize={4}
                        />
                      </div>
                      <p className="ap-qr-hint">
                        <BookingIcon name="qr" size={14} />
                        Xuất trình mã này cho nhân viên tiếp đón khi đến khám
                      </p>
                      <div className="ap-qr-actions">
                        <button
                          type="button"
                          className="ap-btn ap-btn--ghost ap-btn--sm"
                          onClick={handleSaveQr}
                        >
                          <BookingIcon name="download" size={14} />
                          Lưu ảnh QR
                        </button>
                        <button
                          type="button"
                          className="ap-btn ap-btn--ghost ap-btn--sm"
                          onClick={handleCopy}
                        >
                          <BookingIcon name={copied ? "check" : "copy"} size={14} />
                          {copied ? "Đã sao chép mã" : "Sao chép mã"}
                        </button>
                      </div>
                    </>
                  ) : statusKey === "checkedIn" ? (
                    <div className="ap-qr-checked-in">
                      <span className="ap-qr-checked-in__icon">
                        <BookingIcon name="checkCircle" size={26} />
                      </span>
                      <strong>Đã hoàn tất check-in</strong>
                      <p>Bạn đã hoàn tất thủ tục check-in. Vui lòng chờ đến lượt khám.</p>
                    </div>
                  ) : statusKey === "completed" ? (
                    <div className="ap-qr-checked-in">
                      <span className="ap-qr-checked-in__icon">
                        <BookingIcon name="checkCircle" size={26} />
                      </span>
                      <strong>Lịch khám đã hoàn thành</strong>
                      <p>Lượt khám của lịch hẹn này đã hoàn tất.</p>
                    </div>
                  ) : (
                    <div className="ap-qr-invalid">
                      <span className="ap-qr-invalid__icon">
                        <BookingIcon name="x" size={26} />
                      </span>
                      <strong>Mã QR không còn hợp lệ</strong>
                      <p>
                        {statusKey === "cancelled"
                          ? "Lịch hẹn này đã được hủy. Mã QR đã bị vô hiệu hóa."
                          : "Lịch hẹn đã quá hạn check-in (còn dưới 10 phút hoặc đã qua giờ hẹn)."}
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </main>

      {modalOpen && appointment && (
        <ConfirmCancelModal
          appointment={appointment}
          submitting={submitting}
          error={modalError}
          onConfirm={handleCancel}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

export default AppointmentDetailPage;
