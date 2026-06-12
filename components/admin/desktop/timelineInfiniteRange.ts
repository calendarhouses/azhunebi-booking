export const INFINITE_YEARS_BACK = 3;
export const INFINITE_YEARS_FORWARD = 3;

export function buildInfiniteTimelineRange(anchor = new Date()): {
  start: Date;
  end: Date;
  daysCount: number;
} {
  const today = new Date(anchor);
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setFullYear(start.getFullYear() - INFINITE_YEARS_BACK);

  const end = new Date(today);
  end.setFullYear(end.getFullYear() + INFINITE_YEARS_FORWARD);

  const daysCount = Math.round((end.getTime() - start.getTime()) / 86400000);
  return { start, end, daysCount };
}
