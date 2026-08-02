"use client";

import { useEffect, type CSSProperties, type MouseEvent } from "react";
import { buildIncomeCategories, EXPENSE_CATEGORIES } from "../types";
import type { AdminSettingsPayload, BookingRecord, TransactionConfig } from "../types";
import { getCategoryIconPath, INLINE_CARD_CAT_ICONS, DEFAULT_CAT_ICON } from "../reports/financeCategoryIcons";
import { FinanceMobileTable } from "../../mobile/FinanceMobileTable";
import { MetricCard } from "../reports/MetricCard";
import { METRIC_ICON_PATHS } from "../reports/metricIcons";
import { serviceDetailKey } from "../reports/serviceFeeAttribution";
import { useReportsAnalytics } from "../reports/useReportsAnalytics";
import { useAnimatedMetric } from "../reports/useAnimatedMetric";
import { AnalyticsDetailsDrawer } from "../reports/AnalyticsDetailsDrawer";
import { createFlatpickr } from "../flatpickrAdmin";
import { sanitizeIntegerAmountInput } from "@/lib/admin/integerAmountInput";

const CUSTOM_SERVICE_CARD_COLORS = [
  { color: "#B45309", bg: "#FFEDD5" },
  { color: "#047857", bg: "#ECFDF5" },
  { color: "#0369A1", bg: "#E0F2FE" },
  { color: "#BE185D", bg: "#FCE7F3" },
  { color: "#7C3AED", bg: "#F3E8FF" },
] as const;

export interface DesktopReportsViewProps {
  style?: CSSProperties;
  layout?: "desktop" | "mobile";
  bookings: BookingRecord[];
  transactions: TransactionConfig[];
  roomsList: AdminSettingsPayload["roomsList"];
  customPrices: AdminSettingsPayload["customPrices"];
  settings: AdminSettingsPayload;
  onSettingsChange: (settings: AdminSettingsPayload) => void;
  onOpenBooking: (event: MouseEvent | null, row: number | string) => void;
  isActive?: boolean;
}

function CategoryIcon({ title, color, bg }: { title: string; color: string; bg: string }) {
  const path = getCategoryIconPath(title);
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: bg,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <g dangerouslySetInnerHTML={{ __html: path }} />
      </svg>
    </div>
  );
}

export function DesktopReportsView({
  style,
  layout = "desktop",
  bookings,
  transactions,
  roomsList = [],
  customPrices,
  settings,
  onSettingsChange,
  onOpenBooking,
  isActive = true,
}: DesktopReportsViewProps) {
  const isMobile = layout === "mobile";
  const r = useReportsAnalytics({
    bookings,
    transactions,
    roomsList: roomsList || [],
    customPrices,
    settings,
    onSettingsChange,
    onOpenBooking,
    isActive,
  });

  const m = r.analytics?.metrics;

  useEffect(() => {
    if (r.financeView !== "cards" || !r.inlineCardType) return;
    const today = new Date().toISOString().slice(0, 10);
    document.querySelectorAll(".it-date-picker").forEach((el) => {
      if ((el as HTMLElement & { _flatpickr?: unknown })._flatpickr) return;
      createFlatpickr(el as HTMLElement, {
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d.m.Y",
        defaultDate: today,
      });
    });
  }, [r.financeView, r.inlineCardType, r.expandedInlineCard]);

  useEffect(() => {
    if (r.editingTxId == null) return;
    const el = document.getElementById(`editDate-${r.editingTxId}`);
    if (el && !(el as HTMLElement & { _flatpickr?: unknown })._flatpickr) {
      createFlatpickr(el, { dateFormat: "Y-m-d", altInput: true, altFormat: "d.m.Y" });
    }
  }, [r.editingTxId]);

  const incomeCategories = buildIncomeCategories(settings.customServicesList);
  const expenseCategories = EXPENSE_CATEGORIES;
  const inlineCategories = r.inlineCardType === "income" ? incomeCategories : expenseCategories;
  const isIncomeCards = r.inlineCardType === "income";
  const cardColor = isIncomeCards ? "#059669" : "#DC2626";
  const cardBg = isIncomeCards ? "#ECFDF5" : "#FEF2F2";
  const cardBtn = isIncomeCards ? "#10B981" : "#EF4444";

  type ReportServiceCard = {
    id: string;
    iconPaths: string;
    title: string;
    val: number;
    color: string;
    bg: string;
    detail: [string, string, string, string, string];
  };

  const customServices = settings.customServicesList || [];
  const serviceIds = new Set<string>();
  for (const s of customServices) {
    const id = String(s.id ?? "").trim();
    if (!id) continue;
    const revenue = m?.serviceRevenue?.[id] ?? 0;
    if (s.active !== false || revenue > 0) serviceIds.add(id);
  }
  for (const id of Object.keys(m?.serviceRevenue || {})) {
    if ((m?.serviceRevenue?.[id] ?? 0) > 0) serviceIds.add(id);
  }

  const dynamicServiceCards: ReportServiceCard[] = [...serviceIds].map((id, index) => {
    const fromSettings = customServices.find((s) => String(s.id) === id);
    const title =
      m?.serviceNames?.[id] ||
      String(fromSettings?.name || "").trim() ||
      `Послуга ${id}`;
    const palette = CUSTOM_SERVICE_CARD_COLORS[index % CUSTOM_SERVICE_CARD_COLORS.length];
    return {
      id: `cardSvc-${id}`,
      iconPaths: METRIC_ICON_PATHS.other,
      title,
      val: m?.serviceRevenue?.[id] ?? 0,
      color: palette.color,
      bg: palette.bg,
      detail: [serviceDetailKey(id), title, palette.color, palette.bg, "Дохід"],
    };
  });

  const serviceCards: ReportServiceCard[] = [
    {
      id: "cardGuests",
      iconPaths: METRIC_ICON_PATHS.guests,
      title: "Додаткові гості",
      val: m?.currGuests ?? 0,
      color: "#1D4ED8",
      bg: "#E0E7FF",
      detail: ["guests", "Додаткові гості", "#1D4ED8", "#E0E7FF", "Дохід"],
    },
    ...((m?.currPets ?? 0) > 0
      ? [
          {
            id: "cardPets",
            iconPaths: METRIC_ICON_PATHS.pets,
            title: "Тварини",
            val: m?.currPets ?? 0,
            color: "#E11D48",
            bg: "#FCE7F3",
            detail: ["pets", "Тварини", "#E11D48", "#FCE7F3", "Дохід"] as [
              string,
              string,
              string,
              string,
              string,
            ],
          },
        ]
      : []),
    {
      id: "cardEarlyLate",
      iconPaths: METRIC_ICON_PATHS.earlyLate,
      title: "Гнучкий графік",
      val: m?.currEarlyLate ?? 0,
      color: "#6D28D9",
      bg: "#F3E8FF",
      detail: ["earlyLate", "Гнучкий графік", "#6D28D9", "#F3E8FF", "Дохід"],
    },
    ...dynamicServiceCards,
    {
      id: "cardOther",
      iconPaths: METRIC_ICON_PATHS.other,
      title: "Інший дохід",
      val: m?.currOther ?? 0,
      color: "#4B5563",
      bg: "#F3F4F6",
      detail: ["other", "Інший дохід", "#4B5563", "#F3F4F6", "Дохід"],
    },
  ];
  const orderedServices = [...serviceCards].sort((a, b) => {
    const idxA = m?.serviceCardOrder.findIndex((x) => x.id === a.id) ?? 99;
    const idxB = m?.serviceCardOrder.findIndex((x) => x.id === b.id) ?? 99;
    return idxA - idxB;
  });

  const reportTabIconSize = isMobile ? 18 : 20;
  const desktopReportToolbarControlHeight = 60;
  const metricsAnimationKey = r.reportTab;
  const financeTotalsAnimationKey = `${r.reportTab}:${r.financeView}`;
  const totalIncomeAnimated = useAnimatedMetric(m?.totalIncome ?? 0, 1200, true, financeTotalsAnimationKey);
  const totalExpenseAnimated = useAnimatedMetric(m?.totalExpense ?? 0, 1200, true, financeTotalsAnimationKey);
  const profitAnimated = useAnimatedMetric(m?.profit ?? 0, 1200, true, financeTotalsAnimationKey);

  const reportToolbar = (
    <>
      <div className={isMobile ? "report-cal-wrap" : undefined} style={isMobile ? undefined : { position: "relative" }}>
        {isMobile ? (
          <div className="report-cal-btn">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
        ) : (
          <div
            style={{
              width: desktopReportToolbarControlHeight,
              height: desktopReportToolbarControlHeight,
              borderRadius: 12,
              border: "1px solid #D1D5DB",
              background: "#FFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#4B5563",
              pointerEvents: "none",
            }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
          </div>
        )}
        <input
          type="text"
          id="customReportRange"
          readOnly
          className={isMobile ? "report-cal-input" : undefined}
          style={
            isMobile
              ? undefined
              : {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                }
          }
        />
      </div>

      <div
        className={`custom-select-wrapper${r.periodSelectOpen ? " open" : ""}`}
        id="reportPeriodWrapper"
        style={isMobile ? undefined : { width: 220 }}
      >
            <div
              className="custom-select-trigger"
              onClick={() => r.setPeriodSelectOpen((o) => !o)}
              style={{
                position: "relative",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                paddingRight: 36,
                minHeight: isMobile ? undefined : desktopReportToolbarControlHeight,
              }}
            >
              <span id="reportPeriodText">{r.periodLabel}</span>
              {r.periodDisplay ? (
                <span
                  id="reportPeriodDates"
                  style={{ fontSize: 11, fontWeight: 500, color: "#6B7280", lineHeight: 1.2 }}
                >
                  {r.periodDisplay}
                </span>
              ) : null}
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#6B7280"
                viewBox="0 0 24 24"
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div className="custom-select-options">
              {r.periodOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`custom-option${r.period === opt.value ? " selected" : ""}`}
                  onClick={() => r.selectPeriod(opt.value, opt.label)}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          </div>
          <input type="hidden" id="reportPeriodVal" value={r.period} readOnly />

          <button
            type="button"
            id="btnDownloadFinanceReport"
            className="btn-primary btn-report-tg"
            disabled={r.tgSending}
            aria-label="Звіт у Telegram"
            title="Звіт у Telegram"
            onClick={() => void r.downloadFinanceReportToTelegram()}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 10.5 12 15m0 0 4.5-4.5M12 15V3" />
            </svg>
            <span className="btn-report-tg__label">
              {r.tgSending ? "Надсилаємо..." : "Звіт у Telegram"}
            </span>
          </button>
    </>
  );

  return (
    <div id="view-reports" style={style}>
      {isMobile ? (
        <div className="reports-tabs">
          <div
            className={`r-tab${r.reportTab === "finance" ? " active" : ""}`}
            onClick={() => r.switchReportTab("finance")}
          >
            <svg width={reportTabIconSize} height={reportTabIconSize} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>{" "}
            Фінанси
          </div>
          <div
            className={`r-tab${r.reportTab === "analytics" ? " active" : ""}`}
            onClick={() => r.switchReportTab("analytics")}
          >
            <svg width={reportTabIconSize} height={reportTabIconSize} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>{" "}
            Аналітика
          </div>
        </div>
      ) : (
        <div className="reports-header">
          <div className="reports-tabs">
            <div
              className={`r-tab${r.reportTab === "analytics" ? " active" : ""}`}
              onClick={() => r.switchReportTab("analytics")}
            >
              <svg width={reportTabIconSize} height={reportTabIconSize} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              Аналітика
            </div>
            <div
              className={`r-tab${r.reportTab === "finance" ? " active" : ""}`}
              onClick={() => r.switchReportTab("finance")}
            >
              <svg width={reportTabIconSize} height={reportTabIconSize} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Фінанси
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>{reportToolbar}</div>
        </div>
      )}

      {isMobile ? <div className="reports-toolbar-row">{reportToolbar}</div> : null}

      <div id="rep-analytics" style={{ display: r.reportTab === "analytics" ? "block" : "none" }}>
        <div
          style={{
            background: "linear-gradient(to right, #F0FDF4, #ECFDF5)",
            border: "1px solid #A7F3D0",
            borderRadius: 12,
            padding: isMobile ? 16 : "16px 20px",
            marginBottom: isMobile ? 20 : 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              width: isMobile ? 30 : 34,
              height: isMobile ? 30 : 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
              border: "1px solid #86EFAC",
              color: "#047857",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            <svg width={isMobile ? 16 : 18} height={isMobile ? 16 : 18} fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5h15m-12-3.75V10.5m4.5 5.25V7.5m4.5 8.25v-3.75" />
            </svg>
          </span>
          <span
            id="aiSummaryText"
            style={{
              fontSize: isMobile ? 12 : 14,
              fontWeight: 500,
              color: "#065F46",
              lineHeight: isMobile ? 1.4 : 1.5,
            }}
            dangerouslySetInnerHTML={{ __html: m?.aiSummaryHtml || "Генеруємо аналітику..." }}
          />
        </div>

        {isMobile ? (
          <span className="form-section-title">Головні показники</span>
        ) : (
          <h3 className="section-title" style={{ marginBottom: 16, marginTop: 8 }}>
            Головні показники
          </h3>
        )}
        <div className="metrics-grid">
          <MetricCard
            iconBg="#F0FDF4"
            iconColor="#059669"
            iconPaths={METRIC_ICON_PATHS.sum}
            title={isMobile ? "Сума (Всі)" : "Сума бронювань (Прогноз)"}
            value={m?.currSum ?? 0}
            animationKey={metricsAnimationKey}
            onClick={() =>
              r.openUniversalDetails("sum", "Сума бронювань (Прогноз)", "#059669", "#F0FDF4", "Прогноз")
            }
          />
          <MetricCard
            iconBg="#D1FAE5"
            iconColor="#047857"
            iconPaths={METRIC_ICON_PATHS.paid}
            title={isMobile ? "Сплачено" : "Фактично оплачено"}
            value={m?.currPaid ?? 0}
            animationKey={metricsAnimationKey}
            valueStyle={{ color: "#059669" }}
            onClick={() =>
              r.openUniversalDetails("paid", "Фактично оплачено", "#047857", "#D1FAE5", "Оплачено")
            }
          />
          <MetricCard
            className="danger-card"
            iconBg="#FEE2E2"
            iconColor="#DC2626"
            iconPaths={METRIC_ICON_PATHS.debt}
            title="Борг гостей"
            titleStyle={{ color: "#DC2626" }}
            value={m?.currDebt ?? 0}
            animationKey={metricsAnimationKey}
            valueStyle={{ color: "#DC2626" }}
            onClick={() =>
              r.openUniversalDetails("debt", "Список боржників", "#DC2626", "#FEF2F2", "Борг")
            }
          />
          <MetricCard
            iconBg="#EFF6FF"
            iconColor="#2563EB"
            iconPaths={METRIC_ICON_PATHS.count}
            title={isMobile ? "Броней" : "Кількість броней"}
            value={m?.currCount ?? 0}
            animationKey={metricsAnimationKey}
            currency={false}
            onClick={() => r.openUniversalDetails("count", "Список броней", "#2563EB", "#EFF6FF", "")}
          />
        </div>

        {isMobile ? (
          <span className="form-section-title" style={{ marginTop: 16 }}>
            Методи оплати
          </span>
        ) : (
          <h3 className="section-title" style={{ marginBottom: 16, marginTop: 24 }}>
            Методи оплати
          </h3>
        )}
        <div
          className="metrics-grid"
          style={isMobile ? undefined : { gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
        >
          {(
            [
              ["fop", "Оплати на ФОП", m?.statFOP ?? 0, "#059669", "#ECFDF5"],
              ["card", "Оплати на картку", m?.statCard ?? 0, "#6D28D9", "#F3E8FF"],
              ["cash", "Оплати готівкою", m?.statCash ?? 0, "#D97706", "#FEF3C7"],
            ] as const
          ).map(([key, label, val, color, bg]) => (
            <MetricCard
              key={key}
              iconBg={bg}
              iconColor={color}
              iconPaths={METRIC_ICON_PATHS[key]}
              title={label}
              value={val}
              animationKey={metricsAnimationKey}
              onClick={() => r.openUniversalDetails(key, label, color, bg, "Сума")}
            />
          ))}
        </div>

        {isMobile ? (
          <span className="form-section-title" style={{ marginTop: 16 }}>
            Деталізація доходу
          </span>
        ) : (
          <h3 className="section-title" style={{ marginBottom: 16, marginTop: 16 }}>
            Деталізація доходу (продані послуги)
          </h3>
        )}
        <div
          className="metrics-grid"
          style={isMobile ? undefined : { gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
        >
          {orderedServices.map((svc, index) => (
            <MetricCard
              key={svc.id}
              id={svc.id}
              iconBg={svc.bg}
              iconColor={svc.color}
              iconSize={18}
              iconPaths={svc.iconPaths}
              title={svc.title}
              value={svc.val}
              animationKey={metricsAnimationKey}
              valueFontSize={isMobile ? 16 : 20}
              style={{ order: index }}
              onClick={() =>
                r.openUniversalDetails(svc.detail[0], svc.detail[1], svc.detail[2], svc.detail[3], svc.detail[4])
              }
            />
          ))}
        </div>

        <div className="charts-grid">
          <div className="chart-card">
            {isMobile ? (
              <>
                <h3 style={{ marginBottom: 12 }}>Популярність</h3>
                <div className="mode-toggle reports-popularity-toggle" style={{ margin: "0 0 16px 0", padding: 4, width: "100%" }}>
                  {(["count", "money", "nights"] as const).map((mode) => (
                    <div
                      key={mode}
                      id={`chartMode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`}
                      className={`mode-btn${r.roomsChartMode === mode ? " active" : ""}`}
                      onClick={() => r.toggleRoomsChart(mode)}
                    >
                      {mode === "count" ? "Броні" : mode === "money" ? "Дохід" : "Ночі"}
                    </div>
                  ))}
                </div>
                <div style={{ position: "relative", height: 200, width: "100%" }}>
                  <canvas id="roomsChart" />
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24,
                  }}
                >
                  <h3 className="section-title" style={{ margin: 0 }}>
                    Популярність котеджів
                  </h3>
                  <div className="mode-toggle" style={{ margin: 0, padding: 2 }}>
                    {(["count", "money", "nights"] as const).map((mode) => (
                      <div
                        key={mode}
                        id={`chartMode${mode.charAt(0).toUpperCase()}${mode.slice(1)}`}
                        className={`mode-btn${r.roomsChartMode === mode ? " active" : ""}`}
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={() => r.toggleRoomsChart(mode)}
                      >
                        {mode === "count" ? "Броні" : mode === "money" ? "Дохід" : "Ночі"}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ position: "relative", height: 260, width: "100%" }}>
                  <canvas id="roomsChart" />
                </div>
              </>
            )}
          </div>
          <div className="chart-card">
            <h3 style={isMobile ? { marginBottom: 8 } : undefined} className={isMobile ? undefined : "section-title"}>
              Звідки гості
            </h3>
            <div style={{ position: "relative", height: isMobile ? 240 : 260, width: "100%" }}>
              <canvas id="sourceChart" />
            </div>
          </div>
        </div>

        {!isMobile ? (
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <h3 className="section-title">Динаміка доходу</h3>
            <div style={{ position: "relative", height: 280, width: "100%" }}>
              <canvas id="revenueLineChart" />
            </div>
          </div>
        ) : null}
      </div>

      <div id="rep-finance" style={{ display: r.reportTab === "finance" ? "block" : "none" }}>
        <div className="finance-summary">
          <div className="fin-box income" onClick={() => r.openFinanceInlineCards("income")}>
            <div className="add-btn">+</div>
            <span>Доходи</span>
            <h3 id="finIncome">{totalIncomeAnimated}</h3>
          </div>
          <div className="fin-box expense" onClick={() => r.openFinanceInlineCards("expense")}>
            <div className="add-btn">+</div>
            <span>Витрати</span>
            <h3 id="finExpense">{totalExpenseAnimated}</h3>
          </div>
          <div className="fin-box profit" onClick={() => r.openFinanceTable()}>
            <div className="add-btn" title="Повернутись до таблиці">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <span>Чистий Прибуток</span>
            <h3 id="finProfit" style={{ color: (m?.profit ?? 0) >= 0 ? undefined : "#DC2626" }}>
              {profitAnimated}
            </h3>
          </div>
        </div>

        <div style={{ position: "relative", marginTop: 10 }}>
          <div
            id="financeTableWrap"
            className={`fade-section${r.financeView === "table" ? " fade-visible" : " fade-hidden"}`}
            style={{ display: r.financeView === "table" ? "block" : "none" }}
          >
            {isMobile ? (
              <>
                <span className="form-section-title" style={{ margin: "16px 0" }}>
                  Історія транзакцій
                </span>
                <FinanceMobileTable r={r} />
              </>
            ) : (
            <div className="charts-grid" style={{ gridTemplateColumns: "1fr" }}>
              <div className="chart-card card" style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ margin: 0, width: "100%" }}>
                  <thead style={{ background: "#F9FAFB" }}>
                    <tr>
                      <th>Категорія</th>
                      <th>Тип</th>
                      <th>Сума</th>
                      <th>Дії</th>
                    </tr>
                  </thead>
                  <tbody id="financeTableBody">
                    {r.analytics && r.analytics.financeRows.length > 0 ? (
                      r.analytics.financeRows.flatMap((row) => {
                        const isInc = row.type === "income";
                        const color = isInc ? "#059669" : "#DC2626";
                        const iconBg = isInc ? "#ECFDF5" : "#FEF2F2";
                        const sign = isInc ? "+" : "-";
                        const isEditing = row.id != null && r.editingTxId === row.id;
                        const rows = [
                          <tr
                            key={row.key}
                            id={row.id != null ? `mainRow-${row.id}` : undefined}
                            onClick={
                              row.id != null && !row.isSystem
                                ? () => r.toggleEditFinRow(row.id!)
                                : undefined
                            }
                            style={{
                              cursor: row.id != null && !row.isSystem ? "pointer" : undefined,
                              background: isEditing ? "#FAFAFA" : undefined,
                            }}
                          >
                            <td style={{ padding: "16px 20px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                <CategoryIcon title={row.title} color={color} bg={iconBg} />
                                <div>
                                  <strong style={{ fontSize: 15 }}>{row.title}</strong>
                                  <div style={{ fontSize: 13, color: "#6B7280" }}>{row.desc}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "16px 20px" }}>
                              {isInc ? (
                                <span className="badge confirmed" style={{ background: "#D1FAE5", color: "#059669" }}>
                                  Дохід
                                </span>
                              ) : (
                                <span className="badge cancelled" style={{ background: "#FEE2E2", color: "#DC2626" }}>
                                  Витрата
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "16px 20px" }}>
                              <strong style={{ color, fontSize: 15 }}>
                                {sign}
                                {Math.round(row.amount).toLocaleString("uk-UA")} грн
                              </strong>
                            </td>
                            <td style={{ padding: "16px 20px" }} onClick={(e) => e.stopPropagation()}>
                              {row.isSystem ? (
                                <span style={{ color: "#9CA3AF", fontSize: 12, fontWeight: 700, padding: "4px 8px", background: "#F3F4F6", borderRadius: 6 }}>
                                  Auto
                                </span>
                              ) : row.id != null ? (
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button
                                    type="button"
                                    className="btn-icon-only"
                                    onClick={() => r.toggleEditFinRow(row.id!)}
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-icon-only danger"
                                    onClick={() => r.deleteTransaction(row.id!)}
                                  >
                                    🗑
                                  </button>
                                </div>
                              ) : null}
                            </td>
                          </tr>,
                        ];
                        if (isEditing && row.id != null && r.editDraft) {
                          rows.push(
                            <tr key={`edit-${row.id}`} id={`editRow-${row.id}`} className="inline-edit-row">
                              <td colSpan={4} style={{ padding: 0, background: "#FAFAFA" }}>
                                <div style={{ padding: 24, borderLeft: `4px solid ${color}` }}>
                                  <div className="form-grid" style={{ marginBottom: 16 }}>
                                    <div className="form-group">
                                      <label>Сума (грн)</label>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        id={`editAmt-${row.id}`}
                                        value={r.editDraft.amount}
                                        autoComplete="off"
                                        onChange={(e) =>
                                          r.setEditDraft({
                                            ...r.editDraft!,
                                            amount: sanitizeIntegerAmountInput(e.target.value),
                                          })
                                        }
                                        style={{ fontWeight: 800, fontSize: 20, color }}
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label>Дата</label>
                                      <input
                                        type="text"
                                        id={`editDate-${row.id}`}
                                        className="it-date-picker"
                                        value={r.editDraft.date}
                                        onChange={(e) =>
                                          r.setEditDraft({ ...r.editDraft!, date: e.target.value })
                                        }
                                      />
                                    </div>
                                  </div>
                                  <div className="form-group" style={{ marginBottom: 24 }}>
                                    <label>Коментар (необов&apos;язково)</label>
                                    <input
                                      type="text"
                                      id={`editComm-${row.id}`}
                                      value={r.editDraft.comment}
                                      onChange={(e) =>
                                        r.setEditDraft({ ...r.editDraft!, comment: e.target.value })
                                      }
                                    />
                                  </div>
                                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                                    <button type="button" className="btn-secondary" onClick={() => r.toggleEditFinRow(row.id!)}>
                                      Скасувати
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      style={{ background: color, borderColor: color }}
                                      onClick={() => void r.saveInlineEdit(row.id!)}
                                    >
                                      Зберегти зміни
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        }
                        return rows;
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center", color: "#9CA3AF", padding: 40 }}>
                          {r.analytics && r.analytics.bookingsOutsidePeriod > 0 && r.period !== "all"
                            ? `Немає операцій за період ${r.periodDisplay || "обраний"}. Є ${r.analytics.bookingsOutsidePeriod} броней з іншою датою заїзду — оберіть інший період.`
                            : "Немає фінансових операцій за цей період"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>

          <div
            id="financeCardsWrap"
            className={`fade-section${r.financeView === "cards" ? " fade-visible" : " fade-hidden"}`}
            style={{ display: r.financeView === "cards" ? "block" : "none" }}
          >
            <div
              style={{
                margin: isMobile ? "16px 0 12px" : "0 0 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                className={isMobile ? "form-section-title" : "section-title"}
                id="fcTitle"
                style={{ margin: 0, fontSize: isMobile ? undefined : 16, color: cardColor }}
              >
                {isMobile ? "Оберіть категорію" : isIncomeCards ? "Оберіть категорію доходу" : "Оберіть категорію витрати"}
              </span>
              <button
                type="button"
                className={isMobile ? "btn-action tap-btn" : "btn-secondary"}
                style={isMobile ? { padding: "6px 12px", fontSize: 12 } : { padding: "8px 16px", fontSize: 13 }}
                onClick={() => r.openFinanceTable()}
              >
                ✕ Закрити
              </button>
            </div>
            <div className="inline-trans-grid" id="fcGrid">
              {inlineCategories.map((cat, idx) => {
                const svgPath = INLINE_CARD_CAT_ICONS[cat] || DEFAULT_CAT_ICON;
                const draft = r.inlineDrafts[idx] || { amount: "", date: "", comment: "" };
                const active = r.expandedInlineCard === idx;
                return (
                  <div
                    key={cat}
                    className={`it-card${active ? " active" : ""}`}
                    id={`itCard-${idx}`}
                    onClick={() => r.toggleInlineCard(idx)}
                  >
                    <div className="it-header">
                      <div className="it-icon" style={{ background: cardBg, color: cardColor }}>
                        <svg width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <g dangerouslySetInnerHTML={{ __html: svgPath }} />
                        </svg>
                      </div>
                      <div className="it-title">{cat}</div>
                    </div>
                    {active && (
                      <div className="it-body" onClick={(e) => e.stopPropagation()}>
                        <div className="form-grid" style={{ marginBottom: 16, borderTop: "1px dashed #E5E7EB", paddingTop: 20 }}>
                          <div className="form-group">
                            <label>Сума (грн)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              id={`itAmt-${idx}`}
                              placeholder="0"
                              autoComplete="off"
                              value={draft.amount}
                              onChange={(e) =>
                                r.setInlineDrafts((d) => ({
                                  ...d,
                                  [idx]: {
                                    ...draft,
                                    amount: sanitizeIntegerAmountInput(e.target.value),
                                  },
                                }))
                              }
                              style={{ fontWeight: 800, fontSize: 20, color: cardColor }}
                            />
                          </div>
                          <div className="form-group">
                            <label>Дата</label>
                            <input
                              type="text"
                              id={`itDate-${idx}`}
                              className="it-date-picker"
                              value={draft.date}
                              onChange={(e) =>
                                r.setInlineDrafts((d) => ({
                                  ...d,
                                  [idx]: { ...draft, date: e.target.value },
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 24 }}>
                          <label>Коментар (необов&apos;язково)</label>
                          <input
                            type="text"
                            id={`itComm-${idx}`}
                            placeholder="Додаткові деталі..."
                            value={draft.comment}
                            onChange={(e) =>
                              r.setInlineDrafts((d) => ({
                                ...d,
                                [idx]: { ...draft, comment: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                          <button type="button" className="btn-secondary" onClick={() => r.toggleInlineCard(idx)}>
                            Скасувати
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ background: cardBtn, borderColor: cardBtn }}
                            onClick={() =>
                              void r.saveInlineTransaction(r.inlineCardType!, cat, idx)
                            }
                          >
                            Зберегти запис
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <AnalyticsDetailsDrawer
        open={!!r.uniDetails?.open}
        detailKey={r.uniDetails?.type ?? "sum"}
        title={r.uniDetails?.title ?? "Деталі"}
        colorHex={r.uniDetails?.colorHex ?? "#059669"}
        bgHex={r.uniDetails?.bgHex ?? "#F0FDF4"}
        valLabel={r.uniDetails?.valLabel ?? ""}
        items={r.sortedUniDetails}
        onClose={r.closeUniversalDetails}
        onOpenBooking={(row) => onOpenBooking(null, row)}
        onEditTransaction={(id) => r.jumpToFinanceAndEdit(id)}
      />
    </div>
  );
}
