"use client";

import { useEffect, type CSSProperties } from "react";
import { MessengerIcon } from "@/components/admin/shared/MessengerButtons";
import { METRIC_ICON_PATHS } from "./metricIcons";
import type { BosoDetailItem, BosoDetailKey } from "./types";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  cn,
  sectionBlockClass,
} from "@/components/admin/rooms/room-drawer-ui";

export interface AnalyticsDetailsDrawerProps {
  open: boolean;
  detailKey: BosoDetailKey;
  title: string;
  colorHex: string;
  bgHex: string;
  valLabel: string;
  items: BosoDetailItem[];
  onClose: () => void;
  onOpenBooking: (row: number | string) => void;
  onEditTransaction: (id: number) => void;
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function MetricHeaderIcon({
  iconPaths,
  iconBg,
  iconColor,
  compact = false,
}: {
  iconPaths: string;
  iconBg: string;
  iconColor: string;
  compact?: boolean;
}) {
  const box = compact ? 32 : 38;
  const svg = compact ? 17 : 22;
  return (
    <div
      className="metric-icon flex shrink-0 items-center justify-center"
      style={{
        width: box,
        height: box,
        borderRadius: compact ? 8 : 10,
        background: iconBg,
        color: iconColor,
      }}
    >
      <svg width={svg} height={svg} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <g dangerouslySetInnerHTML={{ __html: iconPaths }} />
      </svg>
    </div>
  );
}

function getInitial(name: string): string {
  const ch = name.trim().charAt(0).toUpperCase();
  if (!ch || ch === "+" || ch === "І") return "Г";
  return ch;
}

function DetailCard({
  item,
  colorHex,
  bgHex,
  valLabel,
  onOpenBooking,
  onEditTransaction,
}: {
  item: BosoDetailItem;
  colorHex: string;
  bgHex: string;
  valLabel: string;
  onOpenBooking: (row: number | string) => void;
  onEditTransaction: (id: number) => void;
}) {
  const amountText =
    item.amount > 0 ? `${item.amount.toLocaleString("uk-UA")} грн` : "—";

  return (
    <article className={cn(sectionBlockClass, "overflow-hidden p-0")}>
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold"
            style={{ background: bgHex, color: colorHex }}
          >
            {getInitial(item.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[17px] font-semibold leading-snug text-slate-900">{item.name}</div>
            <div className="mt-1 text-sm text-slate-500">
              Дати: <span className="font-medium text-slate-600">{item.date}</span>
            </div>
          </div>
        </div>
        <div
          className="shrink-0 rounded-lg px-3 py-2 text-right"
          style={{ background: bgHex }}
        >
          <div className="text-[15px] font-extrabold leading-tight" style={{ color: colorHex }}>
            {amountText}
          </div>
          {valLabel ? (
            <div
              className="mt-0.5 text-[10px] font-bold uppercase tracking-wide opacity-80"
              style={{ color: colorHex }}
            >
              {valLabel}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
        {item.isTrans && item.id != null ? (
          <button
            type="button"
            className={cn(btnSecondaryClass, "min-w-[140px] flex-1")}
            onClick={() => onEditTransaction(item.id!)}
          >
            Редагувати запис
          </button>
        ) : item.row != null ? (
          <button
            type="button"
            className="analytics-soft-btn inline-flex h-10 min-w-[140px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-all duration-150 active:scale-[0.98]"
            style={
              {
                "--card-accent": colorHex,
                "--card-bg": bgHex,
              } as CSSProperties
            }
            onClick={() => onOpenBooking(item.row!)}
          >
            Відкрити бронь
          </button>
        ) : null}
        {item.phone ? (
          <a
            href={`https://t.me/+${item.phone}`}
            target="_blank"
            rel="noreferrer"
            className="analytics-soft-btn analytics-telegram-btn inline-flex h-10 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-all duration-150 active:scale-[0.98]"
          >
            <MessengerIcon kind="telegram" size={16} />
            Telegram
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function AnalyticsDetailsDrawer({
  open,
  detailKey,
  title,
  colorHex,
  bgHex,
  valLabel,
  items,
  onClose,
  onOpenBooking,
  onEditTransaction,
}: AnalyticsDetailsDrawerProps) {
  const iconPaths =
    METRIC_ICON_PATHS[detailKey as keyof typeof METRIC_ICON_PATHS] ?? METRIC_ICON_PATHS.sum;

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overflow;
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, [open]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[3200] transition-opacity duration-300",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[4px]"
        onClick={onClose}
        aria-label="Закрити"
      />
      <aside
        className={cn(
          "absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-white antialiased",
          "shadow-[-16px_0_40px_rgba(15,23,42,0.08)]",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-details-title"
      >
        <header className="shrink-0 border-b border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <MetricHeaderIcon
              compact
              iconPaths={iconPaths}
              iconBg={bgHex}
              iconColor={colorHex}
            />
            <h2
              id="analytics-details-title"
              className="min-w-0 flex-1 text-xl font-semibold leading-tight tracking-tight text-slate-900"
            >
              {title}
            </h2>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={onClose}
              aria-label="Закрити"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50/60 to-white p-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
              <MetricHeaderIcon iconPaths={iconPaths} iconBg={bgHex} iconColor={colorHex} />
              <p className="mt-4 text-lg font-semibold text-slate-900">Тут поки порожньо</p>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
                Немає записів, які відповідають цій категорії за обраний період.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item, idx) => (
                <li
                  key={`${item.name}-${item.rawDate}-${idx}`}
                  style={{
                    animation: "analyticsDetailFadeIn 280ms ease-out forwards",
                    animationDelay: `${idx * 40}ms`,
                    opacity: 0,
                  }}
                >
                  <DetailCard
                    item={item}
                    colorHex={colorHex}
                    bgHex={bgHex}
                    valLabel={valLabel}
                    onOpenBooking={(row) => {
                      onClose();
                      onOpenBooking(row);
                    }}
                    onEditTransaction={(id) => {
                      onClose();
                      onEditTransaction(id);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" className={cn(btnPrimaryClass, "w-full")} onClick={onClose}>
            Закрити
          </button>
        </footer>

        <style>{`
          @keyframes analyticsDetailFadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .analytics-soft-btn:hover {
            background: color-mix(in srgb, var(--card-bg) 55%, white);
            border-color: color-mix(in srgb, var(--card-accent) 22%, #e5e7eb);
            color: var(--card-accent);
          }
          .analytics-telegram-btn:hover {
            background: #eff6ff;
            border-color: #bfdbfe;
            color: #0284c7;
          }
        `}</style>
      </aside>
    </div>
  );
}
