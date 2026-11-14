import "./Section.css";

export default function Section({
  children,
  title,
  description,
  actions,
  className = "",
  ...rest
}) {
  const hasHeader = Boolean(title || description || actions);
  const combinedClassName = ["ui-section", className].filter(Boolean).join(" ");

  return (
    <section className={combinedClassName} {...rest}>
      {hasHeader && (
        <header className="ui-section__header">
          <div className="ui-section__headings">
            {title && <h2 className="ui-section__title">{title}</h2>}
            {description && <p className="ui-section__description">{description}</p>}
          </div>
          {actions && <div className="ui-section__actions">{actions}</div>}
        </header>
      )}
      {children && <div className="ui-section__body">{children}</div>}
    </section>
  );
}

