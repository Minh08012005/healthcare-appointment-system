import { useEffect, useRef, useState } from "react";
import { receptionApi } from "../../../api/reception";
import QrScanner from "./QrScanner";
import CheckinNotice from "./CheckinNotice";
import { parseCccdQr, toIsoDate } from "./cccdQr";
import "./checkin.css";

// LT-03 / LT-04 — Tiếp nhận bệnh nhân Offline (API C3-04).
// Quét QR CCCD / nhập tay -> triệu chứng -> chuyên khoa -> phòng -> tiếp nhận -> hiển thị STT.
// Frontend KHÔNG tự cấp STT, KHÔNG tự tạo hàng đợi: STT lấy từ data.queue.stt_hien_thi do Backend trả về.

const EMPTY_FORM = {
  ho_ten: "",
  so_cccd_ho_chieu: "",
  ngay_sinh: "", // dd/mm/yyyy (hiển thị), gửi lên dạng YYYY-MM-DD
  gioi_tinh: "",
  ma_bhyt: "",
  dia_chi: "",
  trieu_chung: "",
  chuyen_khoa_id: "",
  phong_kham_id: "",
};

// Chỉ kiểm tra định dạng/độ dài khớp với validate của C3-04, không thêm nghiệp vụ
function validate(form) {
  const errors = {};
  const hoTen = form.ho_ten.trim();
  const soGiayTo = form.so_cccd_ho_chieu.trim();
  const trieuChung = form.trieu_chung.trim();

  if (!hoTen) errors.ho_ten = "Nhập họ tên bệnh nhân";
  else if (hoTen.length > 100) errors.ho_ten = "Họ tên tối đa 100 ký tự";

  if (!soGiayTo) errors.so_cccd_ho_chieu = "Nhập số CCCD/Hộ chiếu";
  else if (soGiayTo.length > 20) errors.so_cccd_ho_chieu = "Tối đa 20 ký tự";

  if (form.ngay_sinh.trim() && !toIsoDate(form.ngay_sinh)) {
    errors.ngay_sinh = "Ngày sinh không hợp lệ (dd/mm/yyyy)";
  }
  if (form.ma_bhyt.trim().length > 30) errors.ma_bhyt = "Mã BHYT tối đa 30 ký tự";

  if (!trieuChung) errors.trieu_chung = "Nhập triệu chứng";
  else if (trieuChung.length > 1000) errors.trieu_chung = "Triệu chứng tối đa 1000 ký tự";

  if (!form.chuyen_khoa_id) errors.chuyen_khoa_id = "Chọn chuyên khoa";
  if (!form.phong_kham_id) errors.phong_kham_id = "Chọn phòng khám";
  return errors;
}

// Bám đúng body C3-04: trường tùy chọn để trống thì không gửi
function buildPayload(form) {
  const patient = {
    ho_ten: form.ho_ten.trim(),
    so_cccd_ho_chieu: form.so_cccd_ho_chieu.trim(),
  };
  const ngaySinh = form.ngay_sinh.trim() ? toIsoDate(form.ngay_sinh) : null;
  if (ngaySinh) patient.ngay_sinh = ngaySinh;
  if (form.gioi_tinh) patient.gioi_tinh = form.gioi_tinh;
  if (form.ma_bhyt.trim()) patient.ma_bhyt = form.ma_bhyt.trim();
  if (form.dia_chi.trim()) patient.dia_chi = form.dia_chi.trim();

  return {
    patient,
    trieu_chung: form.trieu_chung.trim(),
    chuyen_khoa_id: Number(form.chuyen_khoa_id),
    phong_kham_id: Number(form.phong_kham_id),
  };
}

function errorNotice(err) {
  if (err.status === 401) {
    return { type: "error", title: "Phiên đăng nhập đã hết hạn", text: "Vui lòng đăng nhập lại." };
  }
  if (err.status === 403) {
    return { type: "error", title: "Không có quyền tiếp nhận", text: err.message };
  }
  if (err.status === 409) {
    return { type: "warning", title: "Không thể tiếp nhận", text: err.message };
  }
  return { type: "error", title: "Tiếp nhận thất bại", text: err.message };
}

function Field({ label, htmlFor, error, children }) {
  return (
    <div className="ci-field">
      <label className="ci-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <span className="ci-field__error">{error}</span>}
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="ci-info__row">
      <span>{label}</span>
      <strong>{children || "—"}</strong>
    </div>
  );
}

function OfflineCheckinPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [specialties, setSpecialties] = useState([]);
  const [specialtiesLoading, setSpecialtiesLoading] = useState(true);
  const [specialtiesError, setSpecialtiesError] = useState("");
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState("");
  const roomsRequest = useRef(0); // bỏ kết quả cũ khi đổi chuyên khoa liên tục

  useEffect(() => {
    let ignore = false;
    receptionApi
      .getSpecialties()
      .then((res) => {
        if (!ignore) setSpecialties(res?.data || []);
      })
      .catch((err) => {
        if (!ignore) setSpecialtiesError(err.message);
      })
      .finally(() => {
        if (!ignore) setSpecialtiesLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  };

  const loadRooms = async (chuyenKhoaId) => {
    const reqId = ++roomsRequest.current;
    setRooms([]);
    setRoomsError("");
    if (!chuyenKhoaId) {
      setRoomsLoading(false);
      return;
    }
    setRoomsLoading(true);
    try {
      const res = await receptionApi.getRooms(chuyenKhoaId);
      if (reqId === roomsRequest.current) setRooms(res?.data || []);
    } catch (err) {
      if (reqId === roomsRequest.current) setRoomsError(err.message);
    } finally {
      if (reqId === roomsRequest.current) setRoomsLoading(false);
    }
  };

  const handleSpecialtyChange = (value) => {
    setForm((f) => ({ ...f, chuyen_khoa_id: value, phong_kham_id: "" }));
    setErrors((e) => ({ ...e, chuyen_khoa_id: undefined, phong_kham_id: undefined }));
    loadRooms(value);
  };

  // QR CCCD chỉ điền thông tin hành chính, giữ nguyên triệu chứng / chuyên khoa / phòng đã chọn
  const handleScan = (text) => {
    const info = parseCccdQr(text);
    if (!info) {
      setNotice({
        type: "error",
        title: "Không đọc được QR CCCD",
        text: "Mã QR không đúng định dạng CCCD. Quét lại hoặc nhập thông tin thủ công.",
      });
      return;
    }
    setForm((f) => ({
      ...f,
      ho_ten: info.ho_ten,
      so_cccd_ho_chieu: info.so_cccd,
      ngay_sinh: info.ngay_sinh || f.ngay_sinh,
      gioi_tinh: info.gioi_tinh || f.gioi_tinh,
      dia_chi: info.dia_chi || f.dia_chi,
    }));
    setErrors((e) => ({ ...e, ho_ten: undefined, so_cccd_ho_chieu: undefined, ngay_sinh: undefined }));
    setNotice({
      type: "success",
      title: "Đã đọc thông tin CCCD",
      text: "Kiểm tra lại thông tin, nhập triệu chứng và chọn phòng khám.",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const v = validate(form);
    setErrors(v);
    if (Object.values(v).some(Boolean)) {
      setNotice({ type: "error", title: "Thiếu thông tin", text: "Kiểm tra lại các trường được đánh dấu." });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const res = await receptionApi.offlineCheckin(buildPayload(form));
      setResult(res.data);
    } catch (err) {
      // Giữ nguyên dữ liệu form để Lễ tân sửa và gửi lại
      setNotice(errorNotice(err));
    } finally {
      setSubmitting(false);
    }
  };

  const startNew = () => {
    roomsRequest.current++;
    setForm(EMPTY_FORM);
    setErrors({});
    setNotice(null);
    setResult(null);
    setRooms([]);
    setRoomsError("");
    setRoomsLoading(false);
  };

  if (result) {
    const q = result.queue;
    return (
      <div className="ci-page">
        <CheckinNotice notice={{ type: "success", title: "Tiếp nhận thành công" }} />
        <section className="ci-card ci-card--center">
          <span className="ci-badge ci-badge--teal">B · Offline</span>
          <span>Số thứ tự</span>
          <div className="ci-stt">{q?.stt_hien_thi}</div>
          <div className="ci-info ci-info--compact">
            <InfoRow label="Bệnh nhân">{result.patient?.ho_ten}</InfoRow>
            <InfoRow label="CCCD/Hộ chiếu">{result.patient?.so_cccd_ho_chieu}</InfoRow>
            <InfoRow label="Chuyên khoa">{result.specialty?.ten_chuyen_khoa}</InfoRow>
            <InfoRow label="Phòng khám">{result.room?.ten_phong}</InfoRow>
            <InfoRow label="Đang chờ trước">
              {q?.so_nguoi_cho_truoc != null ? `${q.so_nguoi_cho_truoc} người` : null}
            </InfoRow>
          </div>
          <div className="ci-actions">
            <button type="button" className="ci-btn ci-btn--primary" onClick={startNew}>
              Tiếp nhận bệnh nhân mới
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="ci-page">
      <p className="ci-desc">
        Quét mã QR trên CCCD hoặc nhập thông tin bệnh nhân, ghi triệu chứng và chọn phòng khám để cấp số thứ tự.
      </p>

      <CheckinNotice notice={notice} />

      <form className="ci-grid" onSubmit={handleSubmit} noValidate>
        <section className="ci-card">
          <h3 className="ci-card__title">Thông tin bệnh nhân</h3>
          <QrScanner
            title="Đưa mã QR trên CCCD vào khung quét"
            hint="Hệ thống tự điền thông tin bệnh nhân"
            onResult={handleScan}
          />

          <div className="ci-divider">
            <span>hoặc nhập thủ công</span>
          </div>

          <div className="ci-stack">
            <Field label="Họ tên *" htmlFor="off-ho-ten" error={errors.ho_ten}>
              <input
                id="off-ho-ten"
                className="ci-input"
                value={form.ho_ten}
                onChange={(e) => setField("ho_ten", e.target.value)}
                disabled={submitting}
                autoComplete="off"
              />
            </Field>
            <div className="ci-form-grid ci-form-grid--2">
              <Field label="Số CCCD/Hộ chiếu *" htmlFor="off-cccd" error={errors.so_cccd_ho_chieu}>
                <input
                  id="off-cccd"
                  className="ci-input"
                  value={form.so_cccd_ho_chieu}
                  onChange={(e) => setField("so_cccd_ho_chieu", e.target.value)}
                  disabled={submitting}
                  autoComplete="off"
                />
              </Field>
              <Field label="Mã BHYT" htmlFor="off-bhyt" error={errors.ma_bhyt}>
                <input
                  id="off-bhyt"
                  className="ci-input"
                  value={form.ma_bhyt}
                  onChange={(e) => setField("ma_bhyt", e.target.value)}
                  disabled={submitting}
                  autoComplete="off"
                />
              </Field>
              <Field label="Ngày sinh" htmlFor="off-ngay-sinh" error={errors.ngay_sinh}>
                <input
                  id="off-ngay-sinh"
                  className="ci-input"
                  value={form.ngay_sinh}
                  onChange={(e) => setField("ngay_sinh", e.target.value)}
                  placeholder="dd/mm/yyyy"
                  disabled={submitting}
                  autoComplete="off"
                />
              </Field>
              <Field label="Giới tính" htmlFor="off-gioi-tinh">
                <select
                  id="off-gioi-tinh"
                  className="ci-input"
                  value={form.gioi_tinh}
                  onChange={(e) => setField("gioi_tinh", e.target.value)}
                  disabled={submitting}
                >
                  <option value="">— Chọn —</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </Field>
            </div>
            <Field label="Địa chỉ" htmlFor="off-dia-chi">
              <input
                id="off-dia-chi"
                className="ci-input"
                value={form.dia_chi}
                onChange={(e) => setField("dia_chi", e.target.value)}
                disabled={submitting}
                autoComplete="off"
              />
            </Field>
          </div>
        </section>

        <section className="ci-card">
          <h3 className="ci-card__title">Thông tin khám</h3>
          <div className="ci-stack">
            <Field label="Triệu chứng *" htmlFor="off-trieu-chung" error={errors.trieu_chung}>
              <textarea
                id="off-trieu-chung"
                className="ci-input ci-textarea"
                value={form.trieu_chung}
                onChange={(e) => setField("trieu_chung", e.target.value)}
                maxLength={1000}
                placeholder="VD: Sốt, ho 3 ngày..."
                disabled={submitting}
              />
            </Field>

            <Field
              label="Chuyên khoa *"
              htmlFor="off-chuyen-khoa"
              error={errors.chuyen_khoa_id || specialtiesError}
            >
              <select
                id="off-chuyen-khoa"
                className="ci-input"
                value={form.chuyen_khoa_id}
                onChange={(e) => handleSpecialtyChange(e.target.value)}
                disabled={submitting || specialtiesLoading}
              >
                <option value="">{specialtiesLoading ? "Đang tải..." : "— Chọn chuyên khoa —"}</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ten_chuyen_khoa}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Phòng khám *" htmlFor="off-phong" error={errors.phong_kham_id || roomsError}>
              <select
                id="off-phong"
                className="ci-input"
                value={form.phong_kham_id}
                onChange={(e) => setField("phong_kham_id", e.target.value)}
                disabled={submitting || !form.chuyen_khoa_id || roomsLoading}
              >
                <option value="">
                  {!form.chuyen_khoa_id
                    ? "Chọn chuyên khoa trước"
                    : roomsLoading
                      ? "Đang tải..."
                      : rooms.length === 0
                        ? "Chuyên khoa chưa có phòng"
                        : "— Chọn phòng khám —"}
                </option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.ten_phong}
                  </option>
                ))}
              </select>
            </Field>

            <div className="ci-actions ci-actions--end">
              <button type="submit" className="ci-btn ci-btn--primary" disabled={submitting}>
                {submitting ? "Đang tiếp nhận..." : "Tiếp nhận & cấp STT"}
              </button>
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}

export default OfflineCheckinPage;