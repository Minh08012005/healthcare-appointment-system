import "./Button.css";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  type = "button",
  className = "",
  ...rest
}) {
  const variantClass = `ui-btn--${variant}`;
  const sizeClass = size === "sm" ? "ui-btn--sm" : "";
  const loadingClass = loading ? "ui-btn--loading" : "";
  const combinedClassName = ["ui-btn", variantClass, sizeClass, loadingClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={combinedClassName}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      <span className="ui-btn__content">{children}</span>
    </button>
  );
}

