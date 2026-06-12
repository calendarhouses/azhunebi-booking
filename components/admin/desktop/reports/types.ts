import type { TransactionConfig } from "../types";

export type ReportPeriod = "current" | "prev" | "next" | "year" | "all" | "custom";

export type BosoDetailKey =
  | "sum"
  | "paid"
  | "debt"
  | "creditor"
  | "accrualDebtor"
  | "count"
  | "pets"
  | "guests"
  | "vat"
  | "bikes"
  | "earlyLate"
  | "other"
  | "fop"
  | "card"
  | "cash";

export interface BosoDetailItem {
  name: string;
  phone: string;
  date: string;
  row: number | string | null;
  amount: number;
  isTrans: boolean;
  id?: number;
  rawDate: number;
}

export type BosoDetails = Record<BosoDetailKey, BosoDetailItem[]>;

export function emptyBosoDetails(): BosoDetails {
  return {
    sum: [],
    paid: [],
    debt: [],
    creditor: [],
    accrualDebtor: [],
    count: [],
    pets: [],
    guests: [],
    vat: [],
    bikes: [],
    earlyLate: [],
    other: [],
    fop: [],
    card: [],
    cash: [],
  };
}

export interface ReportPeriodRange {
  startDate: Date;
  endDate: Date;
  period: ReportPeriod;
  periodLabel: string;
  prevStartDate: Date | null;
  prevEndDate: Date | null;
}

export interface IncomeBreakdown {
  base: number;
  guests: number;
  pets: number;
  earlyLate: number;
}

export interface AccrualMetrics {
  creditorTotal: number;
  debtorTotal: number;
  snapshotLabel: string;
}

export interface AnalyticsMetrics {
  currSum: number;
  currCount: number;
  currPaid: number;
  currDebt: number;
  creditorTotal: number;
  debtorTotal: number;
  accrualSnapshotLabel: string;
  prevSum: number;
  prevCount: number;
  statFOP: number;
  statCard: number;
  statCash: number;
  currGuests: number;
  currPets: number;
  currEarlyLate: number;
  currVat: number;
  currBikes: number;
  currOther: number;
  totalIncome: number;
  totalExpense: number;
  profit: number;
  incomeBreakdown: IncomeBreakdown;
  aiSummaryHtml: string;
  serviceCardOrder: Array<{ id: string; val: number }>;
  topRoomsCount: Record<string, number>;
}

export interface FinanceTableRow {
  key: string;
  id: number | null;
  title: string;
  desc: string;
  amount: number;
  type: "income" | "expense";
  isSystem: boolean;
  transaction?: TransactionConfig;
}

export interface FinanceReportLine {
  title: string;
  amount: number;
  sub: string;
}

export interface FinanceReport {
  periodLabel: string;
  periodDisplay: string;
  periodStart: string;
  periodEnd: string;
  bookingsCount: number;
  totalIncome: number;
  cashInflow?: number;
  totalExpense: number;
  profit: number;
  payments: { cash: number; card: number; fop: number };
  incomeLines: FinanceReportLine[];
  expenseLines: FinanceReportLine[];
  accrual?: AccrualMetrics;
}

export interface ChartRoomData {
  counts: Record<string, number>;
  money: Record<string, number>;
  nights: Record<string, number>;
}

export interface ChartSourceData {
  sources: Record<string, number>;
}

export interface ChartRevenueData {
  timeline: Record<string, number>;
}

export interface AnalyticsResult {
  metrics: AnalyticsMetrics;
  details: BosoDetails;
  financeRows: FinanceTableRow[];
  filteredTransactions: TransactionConfig[];
  charts: {
    rooms: ChartRoomData;
    sources: ChartSourceData;
    revenue: ChartRevenueData;
  };
  periodRange: ReportPeriodRange;
  periodDisplay: string;
  bookingsOutsidePeriod: number;
}

export type RoomsChartMode = "count" | "money" | "nights";

export type ReportTab = "analytics" | "finance";

export type FinanceReportModalType = "success" | "empty" | "error";
