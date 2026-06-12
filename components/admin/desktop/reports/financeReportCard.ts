import { GLOBAL_CAT_ICONS, DEFAULT_CAT_ICON } from "./financeCategoryIcons";
import { resolveFinanceReportPeriodText } from "./reportPeriod";
import type { FinanceReport } from "./types";

declare const html2canvas: (
  element: HTMLElement,
  options?: Record<string, unknown>
) => Promise<HTMLCanvasElement>;

const FIN_CAT_ICONS: Record<string, string> = {
  "Оренда котеджів": GLOBAL_CAT_ICONS["Оренда котеджів"],
  "Додаткові гості": GLOBAL_CAT_ICONS["Додаткові гості"],
  Тварини: GLOBAL_CAT_ICONS["Тварини"],
  "Домашні тварини": GLOBAL_CAT_ICONS["Домашні тварини"],
  "Гнучкий графік": GLOBAL_CAT_ICONS["Гнучкий графік"],
  Прибирання: GLOBAL_CAT_ICONS["Прибирання"],
  "Розхідні матеріали": GLOBAL_CAT_ICONS["Розхідні матеріали"],
  "Утримання прилеглої території": GLOBAL_CAT_ICONS["Утримання прилеглої території"],
  _default: DEFAULT_CAT_ICON,
};

function getCatPath(title: string): string {
  if (GLOBAL_CAT_ICONS[title]) return GLOBAL_CAT_ICONS[title];
  if (FIN_CAT_ICONS[title]) return FIN_CAT_ICONS[title];
  return FIN_CAT_ICONS._default;
}

export async function captureFinanceReportCard(
  report: FinanceReport
): Promise<string | null> {
  if (typeof document === "undefined" || typeof html2canvas === "undefined") {
    return null;
  }

  const formatMoneyUa = (n: number) =>
    `${Math.round(Number(n) || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₴`;
  const esc = (s: string) =>
    String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const periodText = resolveFinanceReportPeriodText(report);

  const iconBox = (path: string, bg: string, color: string, size: number) =>
    `<div style="width:${size}px;height:${size}px;border-radius:11px;background:${bg};color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="${Math.round(size * 0.55)}" height="${Math.round(size * 0.55)}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">${path}</svg>
        </div>`;

  const lineRow = (
    l: { title: string; amount: number; sub: string },
    isIncome: boolean
  ) => {
    const amountColor = isIncome ? "#059669" : "#DC2626";
    const iconBg = isIncome ? "#ECFDF5" : "#FEF2F2";
    const iconColor = isIncome ? "#059669" : "#DC2626";
    return `<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
            ${iconBox(getCatPath(l.title), iconBg, iconColor, 40)}
            <div style="flex:1;min-width:0;padding-top:2px;">
                <div style="font-size:15px;font-weight:700;color:#111827;line-height:1.3;">${esc(l.title)}</div>
                ${l.sub ? `<div style="font-size:12px;color:#9CA3AF;margin-top:3px;font-weight:500;">${esc(l.sub)}</div>` : ""}
            </div>
            <div style="font-size:15px;font-weight:900;color:${amountColor};white-space:nowrap;padding-top:2px;">${formatMoneyUa(l.amount)}</div>
        </div>`;
  };

  const renderLines = (
    lines: FinanceReport["incomeLines"],
    isIncome: boolean
  ) => {
    if (!lines || !lines.length)
      return '<div style="font-size:14px;color:#9CA3AF;font-weight:500;padding-left:4px;">Немає записів</div>';
    return lines.map((l) => lineRow(l, isIncome)).join("");
  };

  const payCard = (
    label: string,
    amount: number,
    bg: string,
    border: string,
    color: string,
    iconPath: string
  ) => `
        <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:14px 12px;text-align:center;">
            <div style="display:flex;justify-content:center;margin-bottom:8px;">
                <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.9);color:${color};display:flex;align-items:center;justify-content:center;">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">${iconPath}</svg>
                </div>
            </div>
            <div style="font-size:11px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">${label}</div>
            <div style="font-size:17px;font-weight:900;color:#111827;">${formatMoneyUa(amount)}</div>
        </div>`;

  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;top:0;left:-9999px;width:800px;background:linear-gradient(135deg,#2C351B 0%,#1A1F10 100%);padding:60px 80px;box-sizing:border-box;font-family:Inter,sans-serif;display:flex;justify-content:center;";

  const card = document.createElement("div");
  card.style.cssText =
    "width:100%;background:#FFF;border-radius:20px;padding:35px;box-shadow:0 20px 40px rgba(0,0,0,0.4);position:relative;overflow:hidden;";

  const topAccent = document.createElement("div");
  topAccent.style.cssText =
    "position:absolute;top:0;left:0;width:100%;height:6px;background:linear-gradient(90deg,#556B2F 0%,#8FBC8F 100%);";
  card.appendChild(topAccent);

  const iconReport =
    '<path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />';
  const iconIncomeSec =
    '<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />';
  const iconExpenseSec =
    '<path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />';
  const iconCash =
    '<path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />';
  const iconCard =
    '<path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M5 10V8a2 2 0 012-2h10a2 2 0 012 2v2M7 10v10a2 2 0 002 2h6a2 2 0 002-2V10" />';
  const iconFop =
    '<path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />';

  card.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:14px;border-bottom:1px solid #E5E7EB;padding-bottom:18px;margin-bottom:22px;">
            ${iconBox(iconReport, "#F8FAF7", "#556B2F", 48)}
            <div style="display:block;max-width:100%;">
                <div style="font-size:24px;font-weight:900;color:#111827;letter-spacing:-0.5px;line-height:1.2;">ФІНАНСОВИЙ ЗВІТ</div>
                ${periodText ? `<div style="font-size:14px;color:#6B7280;font-weight:600;margin-top:6px;line-height:1.35;white-space:nowrap;">${esc(periodText)}</div>` : ""}
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:22px;">
            <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:14px;text-align:center;">
                <div style="font-size:11px;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Доходи</div>
                <div style="font-size:18px;font-weight:900;color:#047857;">${formatMoneyUa(report.totalIncome)}</div>
            </div>
            <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:14px;text-align:center;">
                <div style="font-size:11px;font-weight:800;color:#DC2626;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Витрати</div>
                <div style="font-size:18px;font-weight:900;color:#B91C1C;">${formatMoneyUa(report.totalExpense)}</div>
            </div>
            <div style="background:#F8FAF7;border:1px solid #BFE0A6;border-radius:12px;padding:14px;text-align:center;">
                <div style="font-size:11px;font-weight:800;color:#556B2F;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Прибуток</div>
                <div style="font-size:18px;font-weight:900;color:#111827;">${formatMoneyUa(report.profit)}</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:22px;">
            ${payCard("Готівка", report.payments.cash, "#EFF6FF", "#93C5FD", "#1D4ED8", iconCash)}
            ${payCard("Картка", report.payments.card, "#F5F3FF", "#C4B5FD", "#6D28D9", iconCard)}
            ${payCard("ФОП", report.payments.fop, "#F0FDF4", "#86EFAC", "#059669", iconFop)}
        </div>

        ${
          report.accrual
            ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px;">
                <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:14px;text-align:center;">
                    <div style="font-size:11px;font-weight:800;color:#B45309;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Кредиторка</div>
                    <div style="font-size:16px;font-weight:900;color:#B45309;">${formatMoneyUa(report.accrual.creditorTotal)}</div>
                    <div style="font-size:10px;color:#92400E;margin-top:4px;">на ${esc(report.accrual.snapshotLabel)}</div>
                </div>
                <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;text-align:center;">
                    <div style="font-size:11px;font-weight:800;color:#2563EB;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Дебіторка</div>
                    <div style="font-size:16px;font-weight:900;color:#2563EB;">${formatMoneyUa(report.accrual.debtorTotal)}</div>
                    <div style="font-size:10px;color:#1D4ED8;margin-top:4px;">на ${esc(report.accrual.snapshotLabel)}</div>
                </div>
            </div>`
            : ""
        }

        <div style="margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                ${iconBox(iconIncomeSec, "#ECFDF5", "#059669", 32)}
                <span style="font-size:13px;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:0.6px;">Доходи</span>
            </div>
            ${renderLines(report.incomeLines, true)}
        </div>

        <div style="margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
                ${iconBox(iconExpenseSec, "#FEF2F2", "#DC2626", 32)}
                <span style="font-size:13px;font-weight:800;color:#DC2626;text-transform:uppercase;letter-spacing:0.6px;">Витрати</span>
            </div>
            ${renderLines(report.expenseLines, false)}
        </div>
    `;

  container.appendChild(card);
  document.body.appendChild(container);

  try {
    const scale =
      typeof window !== "undefined" && window.innerWidth < 768 ? 1.5 : 2;
    const canvas = await html2canvas(container, {
      width: 800,
      height: container.offsetHeight,
      windowWidth: 800,
      scale,
      backgroundColor: null,
      useCORS: true,
    });
    document.body.removeChild(container);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (err) {
    console.error("Помилка скріншоту звіту:", err);
    if (document.body.contains(container)) document.body.removeChild(container);
    return null;
  }
}
