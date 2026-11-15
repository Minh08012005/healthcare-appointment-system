function NoticeIcon({ type }) {
  if (type === "success") {
    return (
      <svg
        className="ci-notice__icon"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M16.667 5L7.5 14.167 3.333 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === "warning") {
    return (
      <svg
        className="ci-notice__icon"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M10 6v5m0 3h.01"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg
      className="ci-notice__icon"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M10 6v5m0 3h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Thông báo trên màn (Figma: mỗi lúc chỉ hiển thị một thông báo).
// notice = { type: "success" | "error" | "warning", title, text }
function CheckinNotice({ notice }) {
  if (!notice) return null;
  return (
    <div
      className={`ci-notice ci-notice--${notice.type}`}
      role={notice.type === "success" ? "status" : "alert"}
    >
      <NoticeIcon type={notice.type} />
      <div className="ci-notice__body">
        <strong className="ci-notice__title">{notice.title}</strong>
        {notice.text && <p className="ci-notice__text">{notice.text}</p>}
      </div>
    </div>
  );
}

export default CheckinNotice;
