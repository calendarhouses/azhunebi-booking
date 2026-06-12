export function formatPhone(phoneStr: string): string {
  let clean = String(phoneStr || "").replace(/\D/g, "");
  if (clean.length === 9) clean = "380" + clean;
  if (clean.length === 10 && clean.startsWith("0")) clean = "38" + clean;
  return clean;
}

export function parseSafeDate(dateStr: string): Date {
  if (!dateStr?.trim()) return new Date(NaN);
  const iso = normalizeDateToIso(dateStr);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    // Полудень локально — без зсуву дня через timezone (важливо для шахматки)
    const d = new Date(`${iso}T12:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(NaN);
}

/** dd.MM.yyyy або yyyy-MM-dd → yyyy-MM-dd для PostgreSQL DATE */
export function normalizeDateToIso(dateStr: string): string {
  const str = String(dateStr || "").trim();
  if (!str) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const spaced = str.match(/^(\d{4}-\d{2}-\d{2})\s+\d{1,2}:\d{2}/);
  if (spaced) return spaced[1];

  const dotted = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotted) {
    const [, d, m, y] = dotted;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(str.includes("T") ? str : `${str}T00:00:00`);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}`;
  }

  return "";
}
