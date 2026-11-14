function Topbar({ title, userName, onOpenNav, navOpen = false }) {
  const initial = userName ? userName.trim().charAt(0).toUpperCase() : "";

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__menu"
        onClick={onOpenNav}
        aria-label="Mở menu"
        aria-expanded={navOpen}
      >
        ☰
      </button>
      <h2 className="topbar__title">{title}</h2>
      <div className="topbar__user">
        <span className="topbar__avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="topbar__name">{userName}</span>
      </div>
    </header>
  );
}

export default Topbar;