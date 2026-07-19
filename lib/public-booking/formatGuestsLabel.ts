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
