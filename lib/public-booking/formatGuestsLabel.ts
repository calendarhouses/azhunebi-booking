/** Same wording as the public booking receipt (adults + children). */
export function formatGuestsLabel(
  adults: number,
  children = 0,
  youngestAge?: number | null
): string {
  const a = Math.max(0, Math.round(Number(adults) || 0));
  const c = Math.max(0, Math.round(Number(children) || 0));
  const parts: string[] = [];
  if (a > 0) parts.push(`${a} ${a === 1 ? "дорослий" : "дорослих"}`);
  if (c > 0) {
    let childPart = `${c} ${c === 1 ? "дитина" : "дітей"}`;
    if (youngestAge != null && Number.isFinite(Number(youngestAge))) {
      childPart += ` (від ${Math.round(Number(youngestAge))} р.)`;
    }
    parts.push(childPart);
  }
  return parts.length ? parts.join(", ") : "—";
}

/** Компактно для заїзд/виїзд: «2», «2+1» (дорослі+діти). */
export function formatGuestsCompact(adults: number, children = 0): string {
  const a = Math.max(0, Math.round(Number(adults) || 0));
  const c = Math.max(0, Math.round(Number(children) || 0));
  if (a <= 0 && c <= 0) return "—";
  if (c > 0) return `${Math.max(a, 0)}+${c}`;
  return String(a);
}
