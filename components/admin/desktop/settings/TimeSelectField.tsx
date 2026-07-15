"use client";

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${String(hours).padStart(2, "0")}:${minutes}`;
});

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function TimeSelectField({ label, value, onChange }: Props) {
  const options = TIME_OPTIONS.includes(value)
    ? TIME_OPTIONS
    : [value, ...TIME_OPTIONS].sort();

  return (
    <label className="svc-field">
      <span className="svc-field__label">{label}</span>
      <div className="svc-time-select">
        <select
          className="svc-field__input svc-field__select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
