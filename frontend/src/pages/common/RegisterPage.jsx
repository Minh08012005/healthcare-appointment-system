import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import PasswordInput from "../../components/auth/PasswordInput";
import "./auth.css";

const initialForm = {
  ho_ten: "", ngay_sinh: "", gioi_tinh: "", so_cccd_ho_chieu: "", so_dien_thoai: "", dia_chi: "",
  username: "", password: "", confirmPassword: "", ma_bhyt: "",
};

function validate(f) {
  const e = {};
  if (!f.ho_ten.trim()) e.ho_ten = "Vui lòng nhập họ và tên.";
  if (!f.ngay_sinh) e.ngay_sinh = "Vui lòng chọn ngày sinh.";
  if (!f.gioi_tinh) e.gioi_tinh = "Vui lòng chọn giới tính.";
  if (!f.so_cccd_ho_chieu.trim()) e.so_cccd_ho_chieu = "Vui lòng nhập số CCCD hoặc hộ chiếu.";
  else if (f.so_cccd_ho_chieu.trim().length > 20) e.so_cccd_ho_chieu = "CCCD/Hộ chiếu tối đa 20 ký tự.";
  if (!/^[0-9]{9,11}$/.test(f.so_dien_thoai.replace(/\s/g, ""))) e.so_dien_thoai = "Số điện thoại không hợp lệ.";
  if (!f.dia_chi.trim()) e.dia_chi = "Vui lòng nhập địa chỉ.";
  if (!f.username.trim()) e.username = "Vui lòng nhập tên đăng nhập.";
  else if (f.username.trim().length > 50) e.username = "Tên đăng nhập tối đa 50 ký tự.";
  if (f.password.length < 6 || f.password.length > 72) e.password = "Mật khẩu phải từ 6 đến 72 ký tự.";
  if (f.confirmPassword !== f.password) e.confirmPassword = "Mật khẩu xác nhận không khớp.";
  if (f.ma_bhyt.trim().length > 30) e.ma_bhyt = "Mã BHYT tối đa 30 ký tự.";
  return e;
}

// Đưa lỗi backend C2-01 về đúng ô nhập: [tên ô, câu hiển thị]
function mapServerError(message) {
  if (message === "Username đã tồn tại") return ["username", "Tên đăng nhập đã tồn tại."];
  if (message.includes("Username")) return ["username", message];
  if (message.includes("Số điện thoại")) return ["so_dien_thoai", message];
  if (message.includes("Ngày sinh")) return ["ngay_sinh", message];
  if (message.includes("CCCD") || message.includes("hộ chiếu")) return ["so_cccd_ho_chieu", message];
  if (message.includes("BHYT")) return ["ma_bhyt", message];
  return null;
}

function Field({ label, required, error, children }) {
  return (
    <label className="auth__field">
      <span className="auth__label">
        {label}
        {required && <span className="auth__required"> *</span>}
      </span>
      {children}
      {error && (
        <span className="auth__field-error">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="currentColor" />
            <path d="M12 7v6M12 16.5v.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          {error}
        </span>
      )}
    </label>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: "" });
  };

  const inputClass = (name) => `auth__input${errors[name] ? " auth__input--error" : ""}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await authApi.register({
        username: form.username,
        password: form.password,
        ho_ten: form.ho_ten,
        ngay_sinh: form.ngay_sinh,
        gioi_tinh: form.gioi_tinh,
        so_cccd_ho_chieu: form.so_cccd_ho_chieu,
        so_dien_thoai: form.so_dien_thoai.replace(/\s/g, ""),
        dia_chi: form.dia_chi,
        ma_bhyt: form.ma_bhyt,
      });
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err) {
      const mapped = mapServerError(err.message);
      if (mapped) setErrors({ [mapped[0]]: mapped[1] });
      else setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__screen auth__screen--register">
        <header className="auth__appbar">
          <Link to="/login" className="auth__back" aria-label="Quay lại">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="auth__appbar-title">Đăng ký tài khoản</h1>
        </header>

        <main className="auth__body">
          <p className="auth__eyebrow">CỔNG BỆNH NHÂN</p>
          <h2 className="auth__title">Tạo tài khoản mới</h2>
          <p className="auth__desc">
            Vui lòng nhập đầy đủ thông tin để tạo hồ sơ khám bệnh và quản lý lịch hẹn trực tuyến.
          </p>

          <form className="auth__form auth__form--register" onSubmit={handleSubmit} noValidate>
            <section className="auth__section">
              <h3 className="auth__section-title">1. THÔNG TIN CÁ NHÂN</h3>
              <Field label="Họ và tên" required error={errors.ho_ten}>
                <input name="ho_ten" className={inputClass("ho_ten")} value={form.ho_ten} onChange={update} placeholder="Nhập họ và tên đầy đủ" />
              </Field>
              <div className="auth__grid">
                <Field label="Ngày sinh" required error={errors.ngay_sinh}>
                  <input type="date" name="ngay_sinh" className={inputClass("ngay_sinh")} value={form.ngay_sinh} onChange={update} />
                </Field>
                <Field label="Giới tính" required error={errors.gioi_tinh}>
                  <select name="gioi_tinh" className={`${inputClass("gioi_tinh")} auth__select`} value={form.gioi_tinh} onChange={update}>
                    <option value="">Chọn giới tính</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </Field>
              </div>
              <Field label="CCCD / Hộ chiếu" required error={errors.so_cccd_ho_chieu}>
                <input name="so_cccd_ho_chieu" className={inputClass("so_cccd_ho_chieu")} value={form.so_cccd_ho_chieu} onChange={update} placeholder="Nhập số CCCD hoặc hộ chiếu" />
              </Field>
              <Field label="Số điện thoại" required error={errors.so_dien_thoai}>
                <input type="tel" name="so_dien_thoai" className={inputClass("so_dien_thoai")} value={form.so_dien_thoai} onChange={update} placeholder="0912 345 678" />
              </Field>
              <Field label="Địa chỉ" required error={errors.dia_chi}>
                <input name="dia_chi" className={inputClass("dia_chi")} value={form.dia_chi} onChange={update} placeholder="Nhập địa chỉ" />
              </Field>
            </section>

            <section className="auth__section">
              <h3 className="auth__section-title">2. THÔNG TIN TÀI KHOẢN</h3>
              <Field label="Tên đăng nhập" required error={errors.username}>
                <input name="username" className={inputClass("username")} value={form.username} onChange={update} placeholder="Nhập tên đăng nhập" autoComplete="username" />
              </Field>
              <Field label="Mật khẩu" required error={errors.password}>
                <PasswordInput name="password" className={errors.password ? "auth__input--error" : ""} value={form.password} onChange={update} placeholder="••••••••" autoComplete="new-password" />
              </Field>
              <Field label="Xác nhận mật khẩu" required error={errors.confirmPassword}>
                <PasswordInput name="confirmPassword" className={errors.confirmPassword ? "auth__input--error" : ""} value={form.confirmPassword} onChange={update} placeholder="••••••••" autoComplete="new-password" />
              </Field>
              <Field label="BHYT" error={errors.ma_bhyt}>
                <input name="ma_bhyt" className={inputClass("ma_bhyt")} value={form.ma_bhyt} onChange={update} placeholder="NHẬP MÃ BHYT" />
              </Field>
            </section>

            {formError && (
              <div className="auth__alert auth__alert--error auth__alert--inline" role="alert">{formError}</div>
            )}

            <div className="auth__actions">
              <button type="submit" className="auth__btn" disabled={submitting}>
                {submitting ? "Đang đăng ký..." : "Đăng ký tài khoản"}
              </button>
              <p className="auth__switch">
                Đã có tài khoản?<Link to="/login">Đăng nhập</Link>
              </p>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

export default RegisterPage;