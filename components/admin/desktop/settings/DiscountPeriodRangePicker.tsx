"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { PriceRangeCalendar } from "./PriceRangeCalendar";
import type { AdminSettingsPayload } from "../types";

function formatUk(iso: string): string {
  const s = String(iso || "").substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}

function rangeLabel(start: string, end: string): string {
  const s = start?.substring(0, 10) || "";
  const e = end?.substring(0, 10) || "";
  if (!s && !e) return "Дата початку — Дата закінчення";
  if (s && e && s !== e) return `${formatUk(s)} — ${formatUk(e)}`;
  if (s) return formatUk(s);
  return "Дата початку — Дата закінчення";
}

type DiscountPeriodRangePickerProps = {
  settings: AdminSettingsPayload;
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
};

export function DiscountPeriodRangePicker({
  settings,
  startDate,
  endDate,
  onRangeChange,
}: DiscountPeriodRangePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        className="bg-stone-50 rounded-xl p-3 flex justify-between items-center text-sm text-stone-500 w-full hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <span>{rangeLabel(startDate, endDate)}</span>
        <Calendar className="text-stone-400 shrink-0" size={18} strokeWidth={1.5} />
      </button>
      {open ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 rounded-2xl border border-stone-200 bg-white p-3 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <PriceRangeCalendar
            settings={settings}
            startDate={startDate}
            endDate={endDate}
            selectedRoomIds={[]}
            allRoomsActive
            showDayPrices={false}
            onRangeChange={(start, end) => {
              onRangeChange(start, end);
              if (start && end && start !== end) {
                setOpen(false);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
