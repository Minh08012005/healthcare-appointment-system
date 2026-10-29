// Thông báo trên màn (Figma: mỗi lúc chỉ hiển thị một thông báo).
// notice = { type: "success" | "error" | "warning", title, text }
function CheckinNotice({ notice }) {
  if (!notice) return null;
  return (
    <div
      className={`ci-notice ci-notice--${notice.type}`}
      role={notice.type === "success" ? "status" : "alert"}
    >
      <strong>{notice.title}</strong>
      {notice.text && <p>{notice.text}</p>}
    </div>
  );
}

export default CheckinNotice;