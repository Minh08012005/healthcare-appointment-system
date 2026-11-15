import "./Notice.css";

export default function Notice({
  children,
  title,
  variant = "info",
  className = "",
  role,
  ...rest
}) {
  const defaultRole = variant === "error" || variant === "warning" ? "alert" : "status";
  const variantClass = `ui-notice--${variant}`;
  const combinedClassName = ["ui-notice", variantClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={combinedClassName} role={role || defaultRole} {...rest}>
      {title && <strong className="ui-notice__title">{title}</strong>}
      {children && <div className="ui-notice__body">{children}</div>}
    </div>
  );
}

