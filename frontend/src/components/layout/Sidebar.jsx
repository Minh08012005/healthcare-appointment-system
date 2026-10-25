import { NavLink } from "react-router-dom";

function Sidebar({ roleLabel, items, userName, userTitle, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">MEDICARE</div>
      <div className="sidebar__sub">Quản lý khám chữa bệnh</div>
      <span className="sidebar__role">{roleLabel}</span>

      <div className="sidebar__label">MENU</div>
      <nav className="sidebar__nav">
        {items.map((item) => (
          <NavLink key={item.path} to={item.path} end className="sidebar__link">
            <span className="sidebar__dot" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__user">
        <strong>{userName}</strong>
        <span>{userTitle}</span>
        <button className="sidebar__logout" type="button" onClick={onLogout}>
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;