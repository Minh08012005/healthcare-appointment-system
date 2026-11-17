import { Link } from "react-router-dom";
import "./MedicareBrand.css";

/**
 * Unified MEDICARE Brand Component
 * Visual identity: Muted Teal Cross (#4F8C87) + Deep Navy (#0B1F33) Wordmark
 */
function MedicareBrand({
  size = "default",
  subtitle = null,
  to = null,
  className = "",
}) {
  const content = (
    <div className={`medicare-brand medicare-brand--${size} ${className}`.trim()}>
      <span className="medicare-brand__cross" aria-hidden="true">
        <svg
          className="medicare-brand__svg"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="7" y="1" width="4" height="16" rx="2" fill="currentColor" />
          <rect x="1" y="7" width="16" height="4" rx="2" fill="currentColor" />
        </svg>
      </span>
      <div className="medicare-brand__content">
        <span className="medicare-brand__wordmark">MEDICARE</span>
        {subtitle && <span className="medicare-brand__sub">{subtitle}</span>}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="medicare-brand-link" aria-label="MEDICARE - Trang chủ">
        {content}
      </Link>
    );
  }

  return content;
}

export default MedicareBrand;
