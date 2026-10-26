function Topbar({ title, userName, onOpenNav, navOpen = false }) {
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
        <span className="topbar__avatar" />
        {userName}
      </div>
    </header>
  );
}

export default Topbar;