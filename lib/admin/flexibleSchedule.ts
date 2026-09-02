import type { AdminSettingsPayload } from "@/components/admin/desktop/types";

export type FlexibleSchedulePricingMode = "fixed" | "percent_of_day";

export type FlexibleScheduleSettings = {
  earlyFee: number;
  lateFee: number;
  pricingMode: FlexibleSchedulePricingMode;
  percentOfDay: number;
  requiresApproval: boolean;
  standardCheckIn: string;
  standardCheckOut: string;
  /** Від якої години доступний ранній заїзд (перша кнопка на сайті). */
  earlyWindowStart: string;
  /** До якої години доступний ранній заїзд (остання кнопка). */
  earlyWindowEnd: string;
  /** Від якої години доступний пізній виїзд (перша кнопка). */
  lateWindowStart: string;
  /** До якої години доступний пізній виїзд (остання кнопка). */
  lateWindowEnd: string;
  earlyTimes: string[];
  lateTimes: string[];
};

export function flexTimeToMinutes(time: string): number {
  const m = String(time || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function flexMinutesToTime(totalMinutes: number): string {
  const mins = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Hourly slots from start through end (inclusive). */
export function buildHourlyTimeRange(start: string, end: string): string[] {
  const from = flexTimeToMinutes(start);
  const to = flexTimeToMinutes(end);
  if (!from && !to) return [];
  if (from > to) return [];
  const times: string[] = [];
  for (let t = from; t <= to; t += 60) {
    times.push(flexMinutesToTime(t));
  }
  return times;
}

export const DEFAULT_EARLY_WINDOW_START = "09:00";
export const DEFAULT_EARLY_WINDOW_END = "14:00";
export const DEFAULT_LATE_WINDOW_START = "12:00";
export const DEFAULT_LATE_WINDOW_END = "19:00";

export const DEFAULT_EARLY_TIMES = buildHourlyTimeRange(
  DEFAULT_EARLY_WINDOW_START,
  DEFAULT_EARLY_WINDOW_END
);

export const DEFAULT_LATE_TIMES = buildHourlyTimeRange(
  DEFAULT_LATE_WINDOW_START,
  DEFAULT_LATE_WINDOW_END
);

export const DEFAULT_FLEXIBLE_SCHEDULE: FlexibleScheduleSettings = {
  earlyFee: 1000,
  lateFee: 1000,
  pricingMode: "fixed",
  percentOfDay: 0.5,
  requiresApproval: true,
  standardCheckIn: "15:00",
  standardCheckOut: "11:00",
  earlyWindowStart: DEFAULT_EARLY_WINDOW_START,
  earlyWindowEnd: DEFAULT_EARLY_WINDOW_END,
  lateWindowStart: DEFAULT_LATE_WINDOW_START,
  lateWindowEnd: DEFAULT_LATE_WINDOW_END,
  earlyTimes: DEFAULT_EARLY_TIMES,
  lateTimes: DEFAULT_LATE_TIMES,
};

function inferWindowFromTimes(times: string[] | undefined): {
  start: string;
  end: string;
} | null {
  if (!times?.length) return null;
  const sorted = [...times].sort((a, b) => flexTimeToMinutes(a) - flexTimeToMinutes(b));
  return { start: sorted[0], end: sorted[sorted.length - 1] };
}

export function resolveFlexibleScheduleSettings(
  settings?: AdminSettingsPayload | null
): FlexibleScheduleSettings {
  const raw = settings?.flexibleScheduleSettings;
  if (!raw) return { ...DEFAULT_FLEXIBLE_SCHEDULE };

  const merged = {
    ...DEFAULT_FLEXIBLE_SCHEDULE,
    ...raw,
  };

  const inferredEarly = inferWindowFromTimes(raw.earlyTimes);
  const inferredLate = inferWindowFromTimes(raw.lateTimes);

  const earlyWindowStart =
    raw.earlyWindowStart?.trim() || inferredEarly?.start || DEFAULT_EARLY_WINDOW_START;
  const earlyWindowEnd =
    raw.earlyWindowEnd?.trim() || inferredEarly?.end || DEFAULT_EARLY_WINDOW_END;
  const lateWindowStart =
    raw.lateWindowStart?.trim() || inferredLate?.start || DEFAULT_LATE_WINDOW_START;
  const lateWindowEnd =
    raw.lateWindowEnd?.trim() || inferredLate?.end || DEFAULT_LATE_WINDOW_END;

  const earlyTimes = buildHourlyTimeRange(earlyWindowStart, earlyWindowEnd);
  const lateTimes = buildHourlyTimeRange(lateWindowStart, lateWindowEnd);

  return {
    ...merged,
    earlyWindowStart,
    earlyWindowEnd,
    lateWindowStart,
    lateWindowEnd,
    earlyTimes: earlyTimes.length ? earlyTimes : DEFAULT_EARLY_TIMES,
    lateTimes: lateTimes.length ? lateTimes : DEFAULT_LATE_TIMES,
  };
}

export type FlexibleFeeQuote = {
  quotedFee: number;
  billableFee: number;
  pendingApproval: boolean;
};

export function quoteFlexibleFee(
  kind: "early" | "late",
  dayPrice: number,
  settings: AdminSettingsPayload | undefined
): FlexibleFeeQuote {
  const fs = resolveFlexibleScheduleSettings(settings);
  let quotedFee =
    fs.pricingMode === "fixed"
      ? kind === "early"
        ? fs.earlyFee
        : fs.lateFee
      : Math.round(dayPrice * fs.percentOfDay);
  if (!Number.isFinite(quotedFee) || quotedFee < 0) quotedFee = 0;
  const pendingApproval = fs.requiresApproval;
  return {
    quotedFee,
    billableFee: quotedFee,
    pendingApproval,
  };
}

export function buildEarlyCommentToken(time: string, pendingApproval: boolean): string {
  return pendingApproval ? `🕒#early⏳: ${time}` : `🕒 Ранній заїзд: з ${time}`;
}

export function buildLateCommentToken(time: string, pendingApproval: boolean): string {
  return pendingApproval ? `🕒#late⏳: ${time}` : `🕒 Пізній виїзд: до ${time}`;
}

export function parseEarlyLateTimesFromComment(raw: string): {
  earlyTime: string | null;
  lateTime: string | null;
} {
  const earlyTime =
    raw.match(/🕒#early⏳:\s*(\d{2}:\d{2})/)?.[1] ||
    raw.match(/🕒#early:\s*(\d{2}:\d{2})/)?.[1] ||
    raw.match(/🕒\s*Ранній заїзд:\s*з\s*(\d{2}:\d{2})/)?.[1] ||
    null;
  const lateTime =
    raw.match(/🕒#late⏳:\s*(\d{2}:\d{2})/)?.[1] ||
    raw.match(/🕒#late:\s*(\d{2}:\d{2})/)?.[1] ||
    raw.match(/🕒\s*Пізній виїзд:\s*до\s*(\d{2}:\d{2})/)?.[1] ||
    null;
  return { earlyTime, lateTime };
}

export function stripFlexibleTokensFromComment(raw: string): string {
  return raw
    .replace(/🕒#early⏳:\s*\d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/🕒#early:\s*\d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/🕒#late⏳:\s*\d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/🕒#late:\s*\d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(/🕒#postlate⏳:\s*\d{2}:\d{2}(\s*\|\s*)?/g, "")
    .replace(
      /🕒\s*Ранній заїзд:\s*з\s*\d{2}:\d{2}(?:\s*\(очікує підтвердження\))?(\s*\|\s*)?/g,
      ""
    )
    .replace(
      /🕒\s*Пізній виїзд:\s*до\s*\d{2}:\d{2}(?:\s*\(очікує підтвердження\))?(\s*\|\s*)?/g,
      ""
    )
    .replace(
      /🕒\s*Заїзд після пізнього виїзду:\s*з\s*\d{2}:\d{2}(\s*\|\s*)?/g,
      ""
    )
    .replace(/\|\s*\|\s*/g, " | ")
    .replace(/^\|\s*/, "")
    .replace(/\|\s*$/, "")
    .trim();
}

export function confirmFlexibleTokensInComment(raw: string): string {
  return raw
    .replace(/🕒#early⏳:\s*(\d{2}:\d{2})/g, "🕒 Ранній заїзд: з $1")
    .replace(/🕒#late⏳:\s*(\d{2}:\d{2})/g, "🕒 Пізній виїзд: до $1")
    .replace(
      /🕒#postlate⏳:\s*(\d{2}:\d{2})/g,
      "🕒 Заїзд після пізнього виїзду: з $1"
    );
}

export function parseEarlyLatePendingFromComment(raw: string): {
  earlyPending: boolean;
  latePending: boolean;
} {
  return {
    earlyPending:
      /🕒#early⏳:/.test(raw) ||
      /🕒\s*Ранній заїзд:[^(]*\(очікує підтвердження\)/.test(raw),
    latePending:
      /🕒#late⏳:/.test(raw) ||
      /🕒\s*Пізній виїзд:[^(]*\(очікує підтвердження\)/.test(raw),
  };
}

export function percentOfDayToDisplay(percentOfDay: number): number {
  return Math.round(Math.min(1, Math.max(0, percentOfDay)) * 100);
}

export function percentOfDayFromDisplay(percent: number): number {
  return Math.min(100, Math.max(0, percent)) / 100;
}

export function formatFlexibleScheduleCardLabel(
  kind: "early" | "late",
  settings: AdminSettingsPayload | undefined,
  opts: {
    selectedTime?: string | null;
    billableFee?: number;
    quotedFee?: number;
    hasDates?: boolean;
  } = {}
): string {
  const fs = resolveFlexibleScheduleSettings(settings);
  const selectedTime = opts.selectedTime ?? null;
  const quotedFee = opts.quotedFee ?? 0;
  const billableFee = opts.billableFee ?? 0;

  if (selectedTime) {
    if (fs.requiresApproval) {
      return kind === "early" ? `з ${selectedTime} · Запит` : `до ${selectedTime} · Запит`;
    }
    const fee = billableFee > 0 ? billableFee : quotedFee;
    return kind === "early"
      ? `з ${selectedTime} · +${fee.toLocaleString("uk-UA")} ₴`
      : `до ${selectedTime} · +${fee.toLocaleString("uk-UA")} ₴`;
  }

  if (opts.hasDates === false) {
    return "Оберіть дати";
  }

  if (fs.pricingMode === "fixed") {
    const fee = kind === "early" ? fs.earlyFee : fs.lateFee;
    return fs.requiresApproval
      ? `Запит · ${fee.toLocaleString("uk-UA")} ₴`
      : `+${fee.toLocaleString("uk-UA")} ₴`;
  }

  const pct = percentOfDayToDisplay(fs.percentOfDay);
  if (quotedFee > 0) {
    return `+${quotedFee.toLocaleString("uk-UA")} ₴ (${pct}% доби)`;
  }
  return `${pct}% від ціни дня`;
}
