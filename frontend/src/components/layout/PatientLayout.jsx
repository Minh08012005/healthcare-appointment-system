import { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { BOOKING_PATHS } from "../../pages/patient/booking/bookingPaths";
import { HISTORY_PATHS } from "../../pages/patient/history/historyPaths";
import { PUBLIC_PATHS } from "../../pages/public/publicPaths";
import "./PatientLayout.css";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function PatientLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const displayName = user?.ho_ten || user?.username || "Bệnh nhân";
  const initials = getInitials(displayName);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="pl-layout">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="pl-header">
        <div className="pl-header__inner">
          {/* Brand */}
          <NavLink to={BOOKING_PATHS.home} className="pl-brand" aria-label="MEDICARE – Trang chủ">
            <span className="pl-brand__cross" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="7" y="1" width="4" height="16" rx="2" fill="currentColor" />
                <rect x="1" y="7" width="16" height="4" rx="2" fill="currentColor" />
              </svg>
            </span>
            <span className="pl-brand__wordmark">MEDICARE</span>
          </NavLink>

          {/* Desktop Nav */}
          <nav className="pl-nav" aria-label="Patient navigation">
            <NavLink
              to={BOOKING_PATHS.home}
              end
              className={({ isActive }) => `pl-nav__link${isActive ? " pl-nav__link--active" : ""}`}
            >
              Trang chủ
            </NavLink>
            <NavLink
              to={BOOKING_PATHS.specialty}
              className={({ isActive }) => `pl-nav__link${isActive ? " pl-nav__link--active" : ""}`}
            >
              Đặt lịch khám
            </NavLink>
            <NavLink
              to={BOOKING_PATHS.appointments}
              className={({ isActive }) => `pl-nav__link${isActive ? " pl-nav__link--active" : ""}`}
            >
              Lịch hẹn
            </NavLink>
            <NavLink
              to={HISTORY_PATHS.list}
              className={({ isActive }) => `pl-nav__link${isActive ? " pl-nav__link--active" : ""}`}
            >
              Lịch sử khám
              to={PUBLIC_PATHS.news}
              className={({ isActive }) => `pl-nav__link${isActive ? " pl-nav__link--active" : ""}`}
            >
              Tin tức
            </NavLink>
            <NavLink
              to={PUBLIC_PATHS.procedure}
              className={({ isActive }) => `pl-nav__link${isActive ? " pl-nav__link--active" : ""}`}
            >
              Quy trình khám
            </NavLink>
          </nav>

          {/* Account area */}
          <div className="pl-header__right">
            <div className="pl-account" ref={dropdownRef}>
              <button
                type="button"
                className="pl-account__trigger"
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
                onClick={() => setDropdownOpen((v) => !v)}
              >
                <span className="pl-avatar" aria-hidden="true">{initials}</span>
                <span className="pl-account__name">{displayName}</span>
                <svg
                  className={`pl-account__caret${dropdownOpen ? " pl-account__caret--open" : ""}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="pl-dropdown" role="menu">
                  <div className="pl-dropdown__header">
                    <span className="pl-dropdown__name">{displayName}</span>
                    <span className="pl-dropdown__role">Bệnh nhân</span>
                  </div>
                  <div className="pl-dropdown__divider" />
                  <button
                    type="button"
                    className="pl-dropdown__item pl-dropdown__item--danger"
                    role="menuitem"
                    onClick={handleLogout}
                  >
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
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="pl-hamburger"
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="pl-hamburger__bar" />
              <span className="pl-hamburger__bar" />
              <span className="pl-hamburger__bar" />
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {menuOpen && (
          <nav className="pl-mobile-nav" aria-label="Mobile patient navigation">
            <NavLink
              to={BOOKING_PATHS.home}
              end
              className={({ isActive }) => `pl-mobile-nav__link${isActive ? " pl-mobile-nav__link--active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Trang chủ
            </NavLink>
            <NavLink
              to={BOOKING_PATHS.specialty}
              className={({ isActive }) => `pl-mobile-nav__link${isActive ? " pl-mobile-nav__link--active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Đặt lịch khám
            </NavLink>
            <NavLink
              to={BOOKING_PATHS.appointments}
              className={({ isActive }) => `pl-mobile-nav__link${isActive ? " pl-mobile-nav__link--active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Lịch hẹn
            </NavLink>
            <NavLink
              to={HISTORY_PATHS.list}
              className={({ isActive }) => `pl-mobile-nav__link${isActive ? " pl-mobile-nav__link--active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Lịch sử khám
              to={PUBLIC_PATHS.news}
              className={({ isActive }) => `pl-mobile-nav__link${isActive ? " pl-mobile-nav__link--active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Tin tức
            </NavLink>
            <NavLink
              to={PUBLIC_PATHS.procedure}
              className={({ isActive }) => `pl-mobile-nav__link${isActive ? " pl-mobile-nav__link--active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Quy trình khám
            </NavLink>
            <div className="pl-mobile-nav__divider" />
            <button
              type="button"
              className="pl-mobile-nav__logout"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          </nav>
        )}
      </header>

      {/* ── Page Content ──────────────────────────────────────── */}
      <main className="pl-content">
        <Outlet />
      </main>

      {/* ── Shared Patient Footer (C5 Completion) ─────────────── */}
      <footer className="pl-footer">
        <div className="pl-footer__inner">
          <div className="pl-footer__brand-block">
            <div className="pl-footer__brand">
              <span className="pl-brand__cross" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <rect x="7" y="1" width="4" height="16" rx="2" fill="currentColor" />
                  <rect x="1" y="7" width="16" height="4" rx="2" fill="currentColor" />
                </svg>
              </span>
              <span className="pl-footer__wordmark">MEDICARE</span>
            </div>
            <p className="pl-footer__desc">
              Cổng dịch vụ tiếp đón và đặt lịch khám bệnh trực tuyến.
            </p>
          </div>

          <nav className="pl-footer__nav" aria-label="Liên kết nhanh">
            <span className="pl-footer__nav-title">Liên kết nhanh</span>
            <NavLink to={BOOKING_PATHS.home} className="pl-footer__link">
              Trang chủ
            </NavLink>
            <NavLink to={BOOKING_PATHS.specialty} className="pl-footer__link">
              Đặt lịch khám
            </NavLink>
            <NavLink to={BOOKING_PATHS.appointments} className="pl-footer__link">
              Lịch hẹn của tôi
            </NavLink>
            <NavLink to={HISTORY_PATHS.list} className="pl-footer__link">
              Lịch sử khám
            <NavLink to={PUBLIC_PATHS.news} className="pl-footer__link">
              Tin tức
            </NavLink>
            <NavLink to={PUBLIC_PATHS.procedure} className="pl-footer__link">
              Quy trình khám
            </NavLink>
          </nav>
        </div>

        <div className="pl-footer__bottom">
          <div className="pl-footer__bottom-inner">
            <span className="pl-footer__copy">
              © 2026 MEDICARE. Bảo lưu mọi quyền.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PatientLayout;

