/** Sanitize typed integer/money amounts: strip non-digits and leading zeros. */

export function sanitizeIntegerAmountInput(
  raw: string,
  opts?: { allowNegative?: boolean }
): string {
  let s = String(raw ?? "");
  if (opts?.allowNegative) {
    const neg = /^\s*-/.test(s);
    s = s.replace(/[^\d]/g, "");
    s = s.replace(/^0+(?=\d)/, "");
    if (neg) {
      if (s === "") return "-";
      if (s !== "0") return `-${s}`;
    }
    return s;
  }
  s = s.replace(/[^\d]/g, "");
  return s.replace(/^0+(?=\d)/, "");
}

export function parseIntegerAmountInput(
  raw: string,
  allowNegative = false
): number {
  const s = sanitizeIntegerAmountInput(raw, { allowNegative });
  if (s === "" || s === "-") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
