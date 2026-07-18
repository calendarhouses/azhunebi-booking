/** National UA mobile digits (9) from free-form input that already may include +380 / 0. */
export function normalizeUaNationalPhoneDigits(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("380") && digits.length >= 12) {
    digits = digits.slice(3);
  } else if (digits.startsWith("0") && digits.length >= 10) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 9);
}

export function formatUaPhoneE164(raw: string): string {
  const national = normalizeUaNationalPhoneDigits(raw);
  return national ? `+380${national}` : "";
}
