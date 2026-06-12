"use client";

type BookingFormSectionHeadingProps = {
  title: string;
  description?: string;
  /** Акцентний колір заголовка (розшифровка тощо) */
  accent?: boolean;
  /** Менший відступ — вкладені блоки в сітці */
  compact?: boolean;
  className?: string;
};

/** Заголовок + підказка на «ти», як у знижках і конструкторі цін */
export function BookingFormSectionHeading({
  title,
  description,
  accent = false,
  compact = false,
  className = "",
}: BookingFormSectionHeadingProps) {
  const rootClass = [
    "booking-form-section-heading",
    accent ? "booking-form-section-heading--accent" : "",
    compact ? "booking-form-section-heading--compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <h3 className="booking-form-section-heading__title">{title}</h3>
      {description ? <p className="booking-form-section-heading__desc">{description}</p> : null}
    </div>
  );
}
