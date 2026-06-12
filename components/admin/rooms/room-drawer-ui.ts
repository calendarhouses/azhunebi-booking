export const inputClass =
  "h-10 w-full rounded-lg border border-slate-200/90 bg-white px-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.03)] placeholder:text-slate-400 transition-[border-color,box-shadow] duration-200 focus:border-[#556B2F]/45 focus:outline-none focus:ring-2 focus:ring-[#556B2F]/18";

export const sectionBlockClass =
  "rounded-xl border border-slate-100/90 bg-gradient-to-b from-slate-50/70 to-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const sectionHeadingClass =
  "text-xs font-semibold uppercase tracking-wider text-slate-500";

export const fieldLabelClass = "mb-1.5 block text-sm font-medium text-slate-700";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const iconSlotClass =
  "flex shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-[#556B2F] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[transform,box-shadow,border-color,background] duration-200";

export const iconSlotSmClass = cn(iconSlotClass, "h-8 w-8");

export const iconSlotMdClass = cn(iconSlotClass, "h-10 w-10");

export const iconSlotLgClass = cn(iconSlotClass, "h-11 w-11");

export const amenityCardClass =
  "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ease-out";

export const amenityCardIdleClass =
  "border-slate-100 bg-white hover:-translate-y-px hover:border-slate-200 hover:bg-slate-50/90 hover:shadow-[0_4px_14px_rgba(15,23,42,0.06)]";

export const amenityCardActiveClass =
  "border-[#556B2F]/30 bg-[#556B2F]/[0.06] shadow-[0_2px_10px_rgba(85,107,47,0.12)]";

export const amenityCheckClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200";

export const amenityCheckIdleClass = "border-slate-200 bg-white text-transparent group-hover:border-slate-300";

export const amenityCheckActiveClass =
  "border-[#556B2F] bg-[#556B2F] text-white shadow-[0_2px_8px_rgba(85,107,47,0.32)] scale-100";

export const tabActiveClass =
  "admin-premium-btn rounded-lg px-3.5 py-2 text-sm font-semibold transition-transform duration-150 active:scale-[0.98]";

export const tabIdleClass =
  "rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]";

export const btnPrimaryClass =
  "admin-premium-btn inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-60";

export const btnSecondaryClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-all duration-150 hover:bg-slate-50 active:scale-[0.98]";

export const btnDangerClass =
  "inline-flex h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-600 transition-all duration-150 hover:border-red-300 hover:bg-red-50 active:scale-[0.98]";
