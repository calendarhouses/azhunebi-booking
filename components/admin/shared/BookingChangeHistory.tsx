"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchBookingChangeHistory } from "@/components/admin/desktop/adminApi";
import type { BookingChangeHistoryEntry } from "@/components/admin/desktop/types";

type Props = {
  bookingId?: string | null;
  entries?: BookingChangeHistoryEntry[] | null;
};

function formatHistoryAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "";
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function historyTitle(label: string): string {
  const raw = String(label || "").trim();
  if (!raw) return "Зміна";
  if (/^створен/i.test(raw)) return raw;
  return `Зміни у «${raw.toLowerCase()}»`;
}

export function BookingChangeHistory({ bookingId, entries }: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState<BookingChangeHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestedFor = useRef<string | null>(null);

  useEffect(() => {
    setOpen(false);
    setLoaded(null);
    setFailed(false);
    requestedFor.current = null;
  }, [bookingId]);

  useEffect(() => {
    if (!open || !bookingId) return;
    if (requestedFor.current === bookingId) return;
    requestedFor.current = bookingId;

    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchBookingChangeHistory(bookingId)
      .then((res) => {
        if (!cancelled) setLoaded(res);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          requestedFor.current = null;
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, bookingId]);

  const items = useMemo(() => {
    const source = loaded ?? (Array.isArray(entries) ? entries : []);
    return source.filter((e) => e && (e.label || e.to || e.from));
  }, [loaded, entries]);

  if (!bookingId && items.length === 0) return null;

  return (
    <section
      className={`booking-history${open ? " is-open" : ""}`}
      aria-label="Історія змін"
    >
      <button
        type="button"
        className="booking-history__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="booking-history__title">Історія змін</span>
        {items.length > 0 ? (
          <span className="booking-history__count">{items.length}</span>
        ) : null}
        <svg
          className="booking-history__chevron"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div className="booking-history__collapse" hidden={!open}>
        {loading ? (
          <div className="booking-history__status">Завантаження…</div>
        ) : null}
        {failed && !loading ? (
          <div className="booking-history__status">Не вдалося завантажити історію</div>
        ) : null}
        {!loading && !failed && items.length === 0 ? (
          <div className="booking-history__status">Змін поки немає</div>
        ) : null}
        <ol className="booking-history__timeline">
          {items.map((entry, idx) => {
            const key = entry.id || `${entry.at}-${idx}`;
            const detail =
              entry.from && entry.to
                ? `${entry.from} → ${entry.to}`
                : entry.to || entry.from || "";
            return (
              <li key={key} className="booking-history__item">
                <span className="booking-history__dot" aria-hidden />
                <div className="booking-history__body">
                  <div className="booking-history__label">{historyTitle(entry.label)}</div>
                  {detail ? (
                    <div className="booking-history__detail">{detail}</div>
                  ) : null}
                  <div className="booking-history__meta">
                    {formatHistoryAt(entry.at)}
                    {entry.actorName ? ` · ${entry.actorName}` : ""}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
