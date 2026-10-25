function BookingHeader({ title, step, label, onBack, children }) {
  return (
    <header className="booking__header">
      <div className="booking__header-top">
        {onBack && (
          <button type="button" className="booking__back" onClick={onBack} aria-label="Quay lại">
            ←
          </button>
        )}
        <h1 className="booking__title">{title}</h1>
      </div>
      <div className="booking__step">
        <span>Bước {step}/5</span>
        <span className="booking__step-label">{label}</span>
      </div>
      <div className="booking__progress">
        <div className="booking__progress-bar" style={{ width: `${(step / 5) * 100}%` }} />
      </div>
      {children}
    </header>
  );
}

export default BookingHeader;