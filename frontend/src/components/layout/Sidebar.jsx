import { NavLink } from "react-router-dom";

function Sidebar({ roleLabel, items, userName, userTitle, onLogout, open = false, onClose }) {
  return (
    <aside className={`sidebar${open ? " sidebar--open" : ""}`}>
      <button
        type="button"
        className="sidebar__close"
        onClick={onClose}
        aria-label="Đóng menu"
      >
        ✕
      </button>
      <div className="sidebar__header">
        <div className="sidebar__brand">MEDICARE</div>
        <div className="sidebar__sub">Quản lý khám chữa bệnh</div>
        {roleLabel && <span className="sidebar__role">{roleLabel}</span>}
      </div>

      <div className="sidebar__label">MENU</div>
      <nav className="sidebar__nav" aria-label="Điều hướng chính">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end
            className={({ isActive }) =>
              `sidebar__link${isActive ? " active" : ""}`
            }
            onClick={onClose}
          >
            <span className="sidebar__dot" aria-hidden="true" />
            <span className="sidebar__text">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__user">
        <div className="sidebar__user-info">
          <strong className="sidebar__user-name">{userName}</strong>
          <span className="sidebar__user-title">{userTitle}</span>
        </div>
        <button className="sidebar__logout" type="button" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;