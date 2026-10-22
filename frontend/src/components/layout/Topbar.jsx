function Topbar({ title, userName }) {
  return (
    <header className="topbar">
      <h2 className="topbar__title">{title}</h2>
      <div className="topbar__user">
        <span className="topbar__avatar" />
        {userName}
      </div>
    </header>
  );
}

export default Topbar;