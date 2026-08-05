"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
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
  const dirtyRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    // Sync from props unless the user is mid-edit (avoids stale "0" after
    // external recomputes, e.g. clearing a phantom discount → total jumps up).
    if (!focused || !dirtyRef.current) {
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
        dirtyRef.current = false;
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        if (!dirtyRef.current) {
          setText(String(Math.round(Number(valueRef.current) || 0)));
          onBlur?.(e);
          return;
        }
        dirtyRef.current = false;
        const n = parseIntegerAmountInput(text, allowNegative);
        setText(String(n));
        if (n !== valueRef.current) onValueChange(n);
        onBlur?.(e);
      }}
      onChange={(e) => {
        dirtyRef.current = true;
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
