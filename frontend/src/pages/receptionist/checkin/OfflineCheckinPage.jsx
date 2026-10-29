import { useState } from "react";
import { receptionApi } from "../../../api/reception";
import QrScanner from "./QrScanner";
import CheckinNotice from "./CheckinNotice";
import "./checkin.css";

// LT-02 — Check-in Online (API C3-02).
// API chỉ có 1 bước: gửi mã -> Backend kiểm tra + check-in -> trả thông tin lịch hẹn.
// Frontend KHÔNG tự tính cửa sổ 60/10 phút, chỉ hiển thị kết quả Backend trả về.

const pad = (n) => String(n).padStart(2, "0");

// "2026-10-16" + "08:30:00" -> "16/10/2026 · 08:30"
function formatDateTime(date, time) {
    if (!date) return "—";
    const [y, m, d] = date.split("-");
    return `${pad(d)}/${pad(m)}/${y}${time ? ` · ${time.slice(0, 5)}` : ""}`;
}

function errorNotice(err) {
    if (err.code === "TOO_EARLY") {
        return {
            type: "warning",
            title: "Chưa đến thời gian check-in",
            text: err.message,
        };
    }
    if (err.code === "TOO_LATE") {
        return {
            type: "error",
            title: "Đã quá hạn check-in",
            text: `${err.message}. Hướng dẫn bệnh nhân đăng ký tại mục Tiếp đón offline.`,
        };
    }
    if (err.code === "INVALID_STATE") {
        return {
            type: "error",
            title: "Không thể check-in",
            text: err.message,
        };
    }
    if (err.status === 404) {
        return {
            type: "error",
            title: "Mã đặt lịch không hợp lệ",
            text: err.message,
        };
    }
    if (err.status === 401) {
        return {
            type: "error",
            title: "Phiên đăng nhập đã hết hạn",
            text: "Vui lòng đăng nhập lại.",
        };
    }
    return { type: "error", title: "Check-in thất bại", text: err.message };
}

function InfoRow({ label, children }) {
    return (
        <div className="ci-info__row">
            <span>{label}</span>
            <strong>{children || "—"}</strong>
        </div>
    );
}

function OnlineCheckinPage() {
    const [code, setCode] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState(null);
    const [result, setResult] = useState(null);

    const checkin = async (body) => {
        if (submitting) return;
        setSubmitting(true);
        setNotice(null);
        try {
            const res = await receptionApi.checkinOnline(body);
            const room = res.data?.room?.ten_phong;
            setResult(res.data);
            setCode("");
            setNotice({
                type: "success",
                title: "Check-in thành công",
                text: `Bệnh nhân sẽ được đưa vào hàng đợi${room ? ` phòng ${room}` : ""} khi đến giờ khám.`,
            });
        } catch (err) {
            setResult(null);
            setNotice(errorNotice(err));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const value = code.trim();
        if (!value) {
            setNotice({
                type: "error",
                title: "Chưa nhập mã đặt lịch",
                text: "Nhập mã đặt lịch hoặc quét mã QR trên lịch hẹn.",
            });
            return;
        }
        if (value.length > 100) {
            setNotice({
                type: "error",
                title: "Mã đặt lịch không hợp lệ",
                text: "Mã tối đa 100 ký tự.",
            });
            return;
        }
        checkin({ ma_dat_lich: value });
    };

    const handleScan = (text) => {
        const value = text.trim();
        if (value) checkin({ qr_code: value });
    };

    const a = result?.appointment;

    return (
        <div className="ci-page">
            <p className="ci-desc">
                Quét mã QR trên lịch hẹn của bệnh nhân hoặc nhập mã đặt lịch để
                check-in.
            </p>

            <CheckinNotice notice={notice} />

            <div className="ci-grid">
                <section className="ci-card">
                    <h3 className="ci-card__title">Quét mã QR</h3>
                    <QrScanner
                        title="Đưa mã QR vào khung quét"
                        hint="Hệ thống tự nhận diện mã đặt lịch"
                        onResult={handleScan}
                    />

                    <div className="ci-divider">
                        <span>hoặc nhập thủ công</span>
                    </div>

                    <form onSubmit={handleSubmit} noValidate>
                        <label className="ci-label" htmlFor="ma-dat-lich">
                            Mã đặt lịch
                        </label>
                        <div className="ci-inline">
                            <input
                                id="ma-dat-lich"
                                className="ci-input"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="VD: DL20261030-A1B2C3D4"
                                autoComplete="off"
                                disabled={submitting}
                            />
                            <button
                                type="submit"
                                className="ci-btn ci-btn--primary"
                                disabled={submitting}
                            >
                                {submitting ? "Đang check-in..." : "Check-in"}
                            </button>
                        </div>
                        <p className="ci-help">
                            Nhấn Enter để check-in sau khi nhập mã.
                        </p>
                    </form>
                </section>

                <section className="ci-card">
                    <div className="ci-card__head">
                        <h3 className="ci-card__title">Thông tin lịch hẹn</h3>
                        {a && (
                            <span className="ci-badge ci-badge--success">
                                Đã check-in
                            </span>
                        )}
                    </div>

                    {a ? (
                        <div className="ci-info">
                            <InfoRow label="Mã đặt lịch">
                                {a.ma_dat_lich}
                            </InfoRow>
                            <InfoRow label="Bệnh nhân">
                                {result.patient?.ho_ten}
                            </InfoRow>
                            <InfoRow label="Số điện thoại">
                                {result.patient?.so_dien_thoai}
                            </InfoRow>
                            <InfoRow label="Chuyên khoa">
                                {result.specialty?.ten_chuyen_khoa}
                            </InfoRow>
                            <InfoRow label="Bác sĩ">
                                {result.doctor?.ho_ten &&
                                    `BS. ${result.doctor.ho_ten}`}
                            </InfoRow>
                            <InfoRow label="Phòng khám">
                                {result.room?.ten_phong}
                            </InfoRow>
                            <InfoRow label="Thời gian">
                                {formatDateTime(a.ngay_kham, a.gio_kham)}
                            </InfoRow>
                            <InfoRow label="Loại hàng đợi">
                                <span className="ci-badge">A · Online</span>
                            </InfoRow>
                        </div>
                    ) : (
                        <p className="ci-empty">
                            {submitting
                                ? "Đang check-in..."
                                : "Quét mã QR hoặc nhập mã đặt lịch để check-in và xem thông tin lịch hẹn."}
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
}

export default OnlineCheckinPage;