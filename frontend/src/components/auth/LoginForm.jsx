import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import PasswordInput from "./PasswordInput";
import MedicareBrand from "../brand/MedicareBrand";
import { getPostLoginPath } from "../../auth/authPaths";
import "../../pages/common/auth.css";

function LoginForm({
  portalType = "patient",
  badgeText = "CỔNG BỆNH NHÂN",
  title = "Chào mừng bạn",
  desc = "",
  allowedRoles = [],
  brandSubtitle = "Chăm sóc sức khỏe thuận tiện hơn",
  brandSize = "large",
  backTo = "/",
  backLabel = "Về trang chủ",
  staffNote = null,
  showRegisterLink = false,
  switchPortalTo = null,
  switchPortalLabel = null,
  notice = null,
  publicLinks = [],
}) {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mismatch, setMismatch] = useState(null);

  if (loading) return null;
  if (user && !mismatch) {
    return <Navigate to={getPostLoginPath(user.role)} replace />;
  }

  const update = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setInvalid(false);
    setError("");
    setMismatch(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedUsername = form.username.trim();
    if (!trimmedUsername || !form.password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu.");
      setInvalid(true);
      setMismatch(null);
      return;
    }

    setError("");
    setMismatch(null);
    setSubmitting(true);

    try {
      const loggedInUser = await login(trimmedUsername, form.password, allowedRoles);

      // Check portal role boundary (xảy ra TRƯỚC role navigation và TRƯỚC KHI lưu session)
      if (loggedInUser?.mismatch || (loggedInUser?.role && !allowedRoles.includes(loggedInUser.role))) {
        await logout();

        const role = loggedInUser.role;
        if (portalType === "staff" && role === "Bệnh nhân") {
          setMismatch({
            type: "patient-on-staff",
            title: "Tài khoản thuộc Cổng Bệnh nhân",
            message:
              "Tài khoản này dành cho bệnh nhân. Vui lòng chuyển sang trang đăng nhập bệnh nhân để tiếp tục.",
            targetUrl: "/login",
            targetLabel: "Đến trang đăng nhập bệnh nhân",
          });
        } else {
          setMismatch({
            type: "staff-on-patient",
            title: "Tài khoản thuộc Cổng Bệnh viện",
            message:
              "Tài khoản này dành cho nhân viên MEDICARE. Vui lòng sử dụng trang đăng nhập dành cho nhân viên.",
            targetUrl: "/staff/login",
            targetLabel: "Đến trang đăng nhập nhân viên",
          });
        }
        return;
      }

      navigate(getPostLoginPath(loggedInUser.role), { replace: true });
    } catch (err) {
      if (err?.status === 401) {
        setError("Tên đăng nhập hoặc mật khẩu không đúng.");
        setInvalid(true);
      } else {
        setError(err?.message || "Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.");
        setInvalid(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const errorClass = invalid ? "auth__input--error" : "";

  return (
    <div className="auth">
      <div className="auth__screen auth__screen--login">
        {/* Navigation back */}
        {backTo && backLabel && (
          <div className="auth__top-nav">
            <Link to={backTo} className="auth__back-link">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              {backLabel}
            </Link>
          </div>
        )}

        {/* Unified Brand */}
        <div className="auth__brand-wrap">
          <MedicareBrand size={brandSize} subtitle={brandSubtitle} />
        </div>

        {/* Portal Eyebrow Badge */}
        <div className="auth__portal-tag-row">
          <span className={`auth__portal-badge auth__portal-badge--${portalType}`}>
            {badgeText}
          </span>
        </div>

        <h1 className="auth__title">{title}</h1>
        <p className="auth__desc">{desc}</p>

        {notice}

        {staffNote && (
          <div className="auth__staff-note">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>{staffNote}</span>
          </div>
        )}

        {/* Portal Mismatch Informational Panel */}
        {mismatch && (
          <div className="auth__mismatch auth__alert--mismatch" role="status">
            <div className="auth__mismatch-header">
              <span className="auth__mismatch-icon" aria-hidden="true">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <h2 className="auth__mismatch-title">{mismatch.title}</h2>
            </div>
            <p className="auth__mismatch-desc">{mismatch.message}</p>
            <Link to={mismatch.targetUrl} className="auth__btn auth__btn--switch">
              {mismatch.targetLabel} →
            </Link>
          </div>
        )}

        {/* Standard Error Alert */}
        {error && !mismatch && (
          <div className="auth__alert auth__alert--error" role="alert">
            <strong>Đăng nhập không thành công</strong>
            <span className="auth__alert-message">{error}</span>
          </div>
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
              autoFocus
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

          <button
            type="submit"
            className="auth__btn auth__btn--submit"
            disabled={submitting}
          >
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        {showRegisterLink && (
          <p className="auth__switch">
            Chưa có tài khoản? <Link to="/register">Đăng ký tài khoản</Link>
          </p>
        )}

        {switchPortalTo && switchPortalLabel && (
          <p className="auth__switch auth__switch--portal">
            <Link to={switchPortalTo}>{switchPortalLabel}</Link>
          </p>
        )}

        {publicLinks && publicLinks.length > 0 && (
          <p className="auth__switch auth__switch--public">
            Xem thêm:{" "}
            {publicLinks.map((link, idx) => (
              <span key={link.to}>
                <Link to={link.to}>{link.label}</Link>
                {idx < publicLinks.length - 1 && " • "}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

export default LoginForm;
