"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";
import {
  parseIntegerAmountInput,
  sanitizeIntegerAmountInput,
} from "@/lib/admin/integerAmountInput";

type IntegerAmountInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onValueChange: (value: number) => void;
  allowNegative?: boolean;
};

/**
 * Controlled money/integer field without leading-zero glitches (01000 → 1000).
 * Uses text + inputMode so sanitize runs on every keystroke.
 */
export function IntegerAmountInput({
  value,
  onValueChange,
  allowNegative = false,
  onFocus,
  onBlur,
  ...rest
}: IntegerAmountInputProps) {
  const [text, setText] = useState(() => String(Math.round(Number(value) || 0)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(String(Math.round(Number(value) || 0)));
    }
  }, [value, focused]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={text}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        const n = parseIntegerAmountInput(text, allowNegative);
        setText(String(n));
        if (n !== value) onValueChange(n);
        onBlur?.(e);
      }}
      onChange={(e) => {
        const cleaned = sanitizeIntegerAmountInput(e.target.value, { allowNegative });
        setText(cleaned);
        if (cleaned === "" || cleaned === "-") {
          onValueChange(0);
          return;
        }
        onValueChange(parseIntegerAmountInput(cleaned, allowNegative));
      }}
    />
  );
}
