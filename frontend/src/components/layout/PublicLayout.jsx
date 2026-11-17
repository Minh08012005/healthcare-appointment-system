import { useState, useEffect } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { PUBLIC_PATHS } from "../../pages/public/publicPaths";
import PatientLayout from "./PatientLayout";
import "./PatientLayout.css";
import "./PublicLayout.css";

const navClass = ({ isActive }) => `pl-nav__link${isActive ? " pl-nav__link--active" : ""}`;
const mobileClass = ({ isActive }) => `pl-mobile-nav__link${isActive ? " pl-mobile-nav__link--active" : ""}`;

// Khung cho các trang CÔNG KHAI (C6-10): không yêu cầu đăng nhập.
// - Bệnh nhân đã đăng nhập: dùng đúng PatientLayout (đủ menu bệnh nhân).
// - Khách / vai trò khác: header gọn (Tin tức, Quy trình khám, Đăng nhập, Đăng ký).
function PublicLayout() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (loading) {
    return (
      <div className="pl-layout pub-loading" role="status">
        Đang tải...
      </div>
    );
  }
  if (user?.role === "Bệnh nhân") return <PatientLayout />;

  const loggedIn = !!user; // vai trò khác (bác sĩ, lễ tân...): /login tự chuyển về trang làm việc
  const close = () => setMenuOpen(false);

  return (
    <div className="pl-layout pl-layout--public">
      <header className="pl-header">
        <div className="pl-header__inner">
          <NavLink to={PUBLIC_PATHS.news} className="pl-brand" aria-label="MEDICARE – Tin tức">
            <span className="pl-brand__cross" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="7" y="1" width="4" height="16" rx="2" fill="currentColor" />
                <rect x="1" y="7" width="16" height="4" rx="2" fill="currentColor" />
              </svg>
            </span>
            <span className="pl-brand__wordmark">MEDICARE</span>
          </NavLink>

          <nav className="pl-nav" aria-label="Điều hướng công khai">
            <NavLink to={PUBLIC_PATHS.news} className={navClass}>
              Tin tức
            </NavLink>
            <NavLink to={PUBLIC_PATHS.procedure} className={navClass}>
              Quy trình khám
            </NavLink>
          </nav>

          <div className="pl-header__right">
            <div className="pub-actions">
              {loggedIn ? (
                <Link to="/login" className="pub-btn pub-btn--primary">
                  Về trang làm việc
                </Link>
              ) : (
                <>
                  <Link to="/login" className="pub-btn pub-btn--ghost">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="pub-btn pub-btn--primary">
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
            <button
              type="button"
              className="pl-hamburger"
              aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={menuOpen}
              aria-controls="pub-mobile-nav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="pl-hamburger__bar" />
              <span className="pl-hamburger__bar" />
              <span className="pl-hamburger__bar" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            className="pl-mobile-backdrop"
            onClick={close}
            aria-hidden="true"
          />
        )}

        {menuOpen && (
          <nav
            id="pub-mobile-nav"
            className="pl-mobile-nav"
            aria-label="Điều hướng công khai (di động)"
          >
            <NavLink to={PUBLIC_PATHS.news} className={mobileClass} onClick={close}>
              Tin tức
            </NavLink>
            <NavLink to={PUBLIC_PATHS.procedure} className={mobileClass} onClick={close}>
              Quy trình khám
            </NavLink>
            <div className="pl-mobile-nav__divider" />
            {loggedIn ? (
              <Link to="/login" className="pl-mobile-nav__link" onClick={close}>
                Về trang làm việc
              </Link>
            ) : (
              <>
                <Link to="/login" className="pl-mobile-nav__link" onClick={close}>
                  Đăng nhập
                </Link>
                <Link to="/register" className="pl-mobile-nav__link" onClick={close}>
                  Đăng ký
                </Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main className="pl-content">
        <Outlet />
      </main>

      <footer className="pl-footer">
        <div className="pl-footer__bottom">
          <div className="pl-footer__bottom-inner">
            <span className="pl-footer__copy">© 2026 MEDICARE. Bảo lưu mọi quyền.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
