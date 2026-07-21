"use client";

type PriceLineInputProps = {
  value: number;
  onChange: (value: number) => void;
  danger?: boolean;
  maxAmount?: number;
  ariaLabel?: string;
};

/** Inline editable amount (same UX as розшифровка цін). */
export function PriceLineInput({
  value,
  onChange,
  danger,
  maxAmount,
  ariaLabel = "Сума",
}: PriceLineInputProps) {
  const safeValue = String(Math.max(0, Math.round(Number(value) || 0)));
  const inputWidthCh = Math.max(2, safeValue.length);
  const cap =
    maxAmount !== undefined && Number.isFinite(maxAmount)
      ? Math.max(0, Math.round(maxAmount))
      : undefined;

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className="editable-number"
      value={safeValue}
      aria-label={ariaLabel}
      size={inputWidthCh}
      onChange={(e) => {
        const digitsOnly = e.target.value.replace(/[^\d]/g, "").slice(0, 9);
        onChange(Number(digitsOnly) || 0);
      }}
      onBlur={(e) => {
        if (cap === undefined) return;
        const n = Number(e.currentTarget.value.replace(/[^\d]/g, "")) || 0;
        const clamped = Math.min(Math.max(0, Math.round(n)), cap);
        if (clamped !== Math.round(Number(value) || 0)) onChange(clamped);
      }}
      onKeyDown={(e) => {
        if (e.key.length === 1 && !/[0-9]/.test(e.key)) {
          e.preventDefault();
        }
      }}
      onFocus={(e) => e.currentTarget.select()}
      style={{
        width: `${inputWidthCh}ch`,
        color: danger ? "#DC2626" : undefined,
      }}
    />
  );
}
