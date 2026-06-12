"use client";

type CapacityStepperFieldProps = {
  label: string;
  hint?: string;
  value: string;
  min?: number;
  max?: number;
  onChange: (next: string) => void;
};

export function CapacityStepperField({
  label,
  hint,
  value,
  min = 0,
  max = 30,
  onChange,
}: CapacityStepperFieldProps) {
  const adjust = (delta: number) => {
    const current = Math.max(min, Number(value) || min);
    const next = Math.min(max, Math.max(min, current + delta));
    onChange(String(next));
  };

  return (
    <div className="khata-capacity-field">
      <span className="khata-capacity-field__label">{label}</span>
      {hint ? <span className="khata-capacity-field__hint">{hint}</span> : null}
      <div className="khata-onboarding__capacity-wrap khata-capacity-field__stepper">
        <button
          type="button"
          className="khata-onboarding__capacity-btn"
          onClick={() => adjust(-1)}
          aria-label={`Зменшити: ${label}`}
        >
          -
        </button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <button
          type="button"
          className="khata-onboarding__capacity-btn"
          onClick={() => adjust(1)}
          aria-label={`Збільшити: ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
