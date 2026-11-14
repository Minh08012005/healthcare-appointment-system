import "./Badge.css";

export default function Badge({
  children,
  variant = "neutral",
  className = "",
  ...rest
}) {
  const variantClass = `ui-badge--${variant}`;
  const combinedClassName = ["ui-badge", variantClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={combinedClassName} {...rest}>
      {children}
    </span>
  );
}

