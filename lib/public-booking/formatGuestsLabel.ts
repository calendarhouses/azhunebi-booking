/** Same wording as the public booking receipt (adults + children). */
export function formatGuestsLabel(adults: number, children = 0): string {
  const a = Math.max(0, Math.round(Number(adults) || 0));
  const c = Math.max(0, Math.round(Number(children) || 0));
  const parts: string[] = [];
  if (a > 0) parts.push(`${a} ${a === 1 ? "дорослий" : "дорослих"}`);
  if (c > 0) parts.push(`${c} ${c === 1 ? "дитина" : "дітей"}`);
  return parts.length ? parts.join(", ") : "—";
}
