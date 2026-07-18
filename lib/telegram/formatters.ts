const UK_MONTHS = [
  "січня",
  "лютого",
  "березня",
  "квітня",
  "травня",
  "червня",
  "липня",
  "серпня",
  "вересня",
  "жовтня",
  "листопада",
  "грудня",
];

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatDateUk(value?: string | Date | null): string {
  if (!value) return "—";
  const date =
    value instanceof Date
      ? value
      : new Date(String(value).includes("T") ? String(value) : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return `${date.getDate()} ${UK_MONTHS[date.getMonth()]}`;
}

export function formatMoneyUa(value?: number | string | null): string {
  const n = Math.round(Number(value) || 0);
  return `${n.toLocaleString("uk-UA")} ₴`;
}

export function formatPhoneDisplay(phone?: string | null): string {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 9) digits = `380${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) digits = `38${digits}`;
  return digits ? `+${digits}` : "";
}

export function toDateKeyKyiv(value?: string | Date | null): string {
  if (!value && value !== 0) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str.includes("T") ? str : `${str}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
}

export function todayKeyKyiv(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
}

export function isActiveBookingStatus(status: unknown): boolean {
  const s = String(status || "").toLowerCase();
  return !s.includes("скас") && !s.includes("нов") && !s.includes("очікує");
}

/** Active confirmed bookings (exclude cancelled / unpaid waiting). */
export function isConfirmedBookingStatus(status: unknown): boolean {
  const s = String(status || "").toLowerCase();
  if (s.includes("скас")) return false;
  if (s.includes("очікує оплату")) return false;
  if (s.includes("на підтвердженні") || s.includes("pending")) return false;
  return true;
}
