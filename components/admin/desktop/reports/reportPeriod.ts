import { parseSafeDate } from "../adminDates";
import type { ReportPeriod, ReportPeriodRange } from "./types";

export const REPORT_PERIOD_LABELS: Record<Exclude<ReportPeriod, "custom">, string> = {
  current: "Поточний місяць",
  prev: "Минулий місяць",
  next: "Наступний місяць",
  year: "За весь рік",
  all: "За весь час",
};

/** Бронь входить у звіт, якщо дата заїзду (check-in) у межах періоду — як у старій BOSO. */
export function isBookingCheckInInPeriod(
  checkIn: string,
  startDate: Date,
  endDate: Date
): boolean {
  const bDate = new Date(parseSafeDate(checkIn));
  if (isNaN(bDate.getTime())) return false;
  return bDate >= startDate && bDate <= endDate;
}

export function formatFinanceReportPeriodDisplay(
  period: ReportPeriod,
  periodLabel: string,
  startDate: Date,
  endDate: Date
): string {
  if (period === "all" || period === "custom") return periodLabel || "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => {
    if (!d || isNaN(d.getTime())) return "";
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  };
  const from = fmt(startDate);
  const to = fmt(endDate);
  return from && to ? `${from} — ${to}` : periodLabel || "";
}

export function resolveFinanceReportPeriodText(report: {
  periodDisplay?: string;
  periodStart?: string;
  periodEnd?: string;
}): string {
  if (report?.periodDisplay) return String(report.periodDisplay);
  if (report?.periodStart && report?.periodEnd) {
    return formatFinanceReportPeriodDisplay(
      "current",
      "",
      new Date(report.periodStart),
      new Date(report.periodEnd)
    );
  }
  return "";
}

export function getReportPeriodDates(
  period: ReportPeriod,
  periodLabel: string,
  customRange?: { start: Date; end: Date } | null
): Pick<ReportPeriodRange, "startDate" | "endDate" | "period" | "periodLabel"> {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (period === "current") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === "prev") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === "next") {
    startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
  } else if (period === "year") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
  } else if (period === "custom" && customRange) {
    startDate = new Date(customRange.start);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(customRange.end);
    endDate.setHours(23, 59, 59, 999);
  } else {
    startDate = new Date(2000, 0, 1);
    endDate = new Date(2100, 0, 1);
  }

  return { startDate, endDate, period, periodLabel };
}

export function getAnalyticsPeriodRange(
  period: ReportPeriod,
  periodLabel: string,
  customRange?: { start: Date; end: Date } | null
): ReportPeriodRange {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date | null = null;
  let prevEndDate: Date | null = null;

  if (period === "current") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  } else if (period === "prev") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
  } else if (period === "next") {
    startDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);
    prevStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  } else if (period === "year") {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
    prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
  } else if (period === "custom" && customRange) {
    startDate = new Date(customRange.start);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(customRange.end);
    endDate.setHours(23, 59, 59, 999);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    prevEndDate = new Date(startDate.getTime() - 1000 * 60 * 60 * 24);
    prevEndDate.setHours(23, 59, 59, 999);
    prevStartDate = new Date(prevEndDate.getTime() - diffTime);
    prevStartDate.setHours(0, 0, 0, 0);
  } else {
    startDate = new Date(2000, 0, 1);
    endDate = new Date(2100, 0, 1);
    prevStartDate = null;
    prevEndDate = null;
  }

  return {
    startDate,
    endDate,
    period,
    periodLabel,
    prevStartDate,
    prevEndDate,
  };
}
