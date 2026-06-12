/** IDs видалених знижок, поки сервер ще не підтвердив збереження (захист від silent sync). */
const pendingDeletedDiscountIds = new Set<number>();

export function markDiscountDeleted(id: number): void {
  if (Number.isFinite(id)) pendingDeletedDiscountIds.add(id);
}

export function unmarkDiscountDeleted(id: number): void {
  pendingDeletedDiscountIds.delete(id);
}

export function filterPendingDeletedDiscounts<T extends { id: number }>(list: T[]): T[] {
  if (pendingDeletedDiscountIds.size === 0) return list;
  return list.filter((d) => !pendingDeletedDiscountIds.has(d.id));
}

/** Знімає tombstone, якщо сервер уже не повертає цю знижку. */
export function reconcilePendingDeletedDiscounts(serverList: { id: number }[]): void {
  if (pendingDeletedDiscountIds.size === 0) return;
  const serverIds = new Set(serverList.map((d) => d.id));
  for (const id of pendingDeletedDiscountIds) {
    if (!serverIds.has(id)) pendingDeletedDiscountIds.delete(id);
  }
}
