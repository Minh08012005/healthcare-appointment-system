import { useState } from "react";

function PasswordInput({ className = "", ...props }) {
  const [show, setShow] = useState(false);

  return (
    <span className="auth__input-wrap">
      <input {...props} type={show ? "text" : "password"} className={`auth__input ${className}`} />
      <button
        type="button"
        className="auth__eye"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
          {show && <line x1="3" y1="3" x2="21" y2="21" />}
        </svg>
      </button>
    </span>
  );
}

export default PasswordInput;