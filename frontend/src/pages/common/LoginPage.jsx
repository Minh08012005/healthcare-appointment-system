import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import PasswordInput from "../../components/auth/PasswordInput";
import "./auth.css";

function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/patient" replace />;

  const update = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setInvalid(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      setInvalid(true);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await login(form.username.trim(), form.password);
      navigate("/patient", { replace: true });
    } catch (err) {
      if (err.status === 401) {
        setError("Tên đăng nhập hoặc mật khẩu không đúng.");
        setInvalid(true);
      } else {
        setError(err.message);
        setInvalid(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const errorClass = invalid ? "auth__input--error" : "";

  return (
    <div className="auth">
      <div className="auth__screen">
        <div className="auth__brand">
          <span className="auth__logo" aria-hidden="true" />
          <div>
            <div className="auth__brand-name">MEDICARE</div>
            <div className="auth__brand-sub">Chăm sóc sức khỏe thuận tiện hơn</div>
          </div>
        </div>

        <p className="auth__eyebrow">CỔNG BỆNH NHÂN</p>
        <h1 className="auth__title">Chào mừng bạn</h1>
        <p className="auth__desc">Đăng nhập để quản lý lịch hẹn và theo dõi quá trình khám.</p>

        {location.state?.registered && (
          <div className="auth__alert auth__alert--success">Đăng ký thành công, mời bạn đăng nhập.</div>
        )}

        <form className="auth__form auth__form--login" onSubmit={handleSubmit} noValidate>
          <label className="auth__field">
            <span className="auth__label">Tên đăng nhập</span>
            <input
              name="username"
              className={`auth__input ${errorClass}`}
              value={form.username}
              onChange={update}
              placeholder="Nhập tên đăng nhập"
              autoComplete="username"
            />
          </label>
          <label className="auth__field">
            <span className="auth__label">Mật khẩu</span>
            <PasswordInput
              name="password"
              className={errorClass}
              value={form.password}
              onChange={update}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="auth__btn" disabled={submitting}>
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="auth__switch">
          Chưa có tài khoản?<Link to="/register">Đăng ký tài khoản</Link>
        </p>

        {error && (
          <div className="auth__alert auth__alert--error" role="alert">
            <strong>Đăng nhập không thành công</strong>
            <span className="auth__alert-message">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;