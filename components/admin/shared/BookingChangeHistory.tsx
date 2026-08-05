"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  listBookingActivity,
  type BookingActivityItem,
} from "@/lib/gas-api";
import "./BookingChangeHistory.css";

type Props = {
  orderId: string;
};

function displayVal(raw: string): string {
  const s = String(raw || "").trim();
  if (!s || s === "—") return "Не вказано";
  return s;
}

function formatHistoryWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timePart = d.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} о ${timePart}`;
}

function itemDiff(item: BookingActivityItem): string | null {
  const fromRaw = String(item.from || "").trim();
  const toRaw = String(item.to || "").trim();
  const summary = String(item.summary || "").trim();
  if (!fromRaw && !toRaw) {
    return summary || null;
  }
  const from = displayVal(item.from);
  const to = displayVal(item.to);
  if (!fromRaw && toRaw) return to;
  if (from === to) return to;
  return `${from} → ${to}`;
}

function itemTitle(item: BookingActivityItem): string {
  const label = String(item.label || "").trim();
  if (label) return `Зміни у «${label.toLocaleLowerCase("uk-UA")}»`;
  if (item.type === "booking.create" || item.type === "create") return "Створено бронь";
  if (item.type === "booking.delete" || item.type === "delete") return "Видалено бронь";
  return String(item.summary || "Зміна").trim() || "Зміна";
}

/**
 * Історія змін у drawer броні.
 * GAS викликається лише при першому розгортанні секції — не на boot і не при відкритті drawer.
 */
export function BookingChangeHistory({ orderId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BookingActivityItem[]>([]);
  const abortRef = useRef(0);

  // При зміні броні скидаємо кеш — наступний expand знову піде в GAS.
  useEffect(() => {
    setOpen(false);
    setLoading(false);
    setLoadedFor(null);
    setError(null);
    setItems([]);
    abortRef.current += 1;
  }, [orderId]);

  const load = useCallback(async (id: string) => {
    const token = ++abortRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await listBookingActivity(id);
      if (token !== abortRef.current) return;
      setItems(data.items);
      setLoadedFor(id);
    } catch (e) {
      if (token !== abortRef.current) return;
      setError(e instanceof Error ? e.message : "Не вдалося завантажити історію");
      setItems([]);
      setLoadedFor(null);
    } finally {
      if (token === abortRef.current) setLoading(false);
    }
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && loadedFor !== orderId && !loading) {
      void load(orderId);
    }
  };

  if (!orderId) return null;

  const showCount = loadedFor === orderId && !loading;
  const count = items.length;

  return (
    <section className="booking-change-history" aria-label="Журнал змін">
      <button
        type="button"
        className="booking-change-history__toggle"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="booking-change-history__title-wrap">
          <span className="booking-change-history__title">Журнал змін</span>
          {showCount && count > 0 ? (
            <span className="booking-change-history__badge" aria-label={`${count} змін`}>
              {count}
            </span>
          ) : null}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`booking-change-history__chevron${open ? " booking-change-history__chevron--open" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="booking-change-history__body">
          {loading ? (
            <p className="booking-change-history__status">Завантаження…</p>
          ) : error ? (
            <div className="booking-change-history__status booking-change-history__status--error">
              <p>{error}</p>
              <button
                type="button"
                className="booking-change-history__retry"
                onClick={() => void load(orderId)}
              >
                Спробувати ще
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="booking-change-history__status">Поки немає записів про зміни</p>
          ) : (
            <ul className="booking-change-history__list">
              {items.map((item) => {
                const diff = itemDiff(item);
                const when = formatHistoryWhen(item.at);
                const actor = String(item.actorName || "").trim();
                const meta = [when, actor].filter(Boolean).join(" · ");
                return (
                  <li key={item.id} className="booking-change-history__item">
                    <span className="booking-change-history__dot" aria-hidden />
                    <div className="booking-change-history__content">
                      <div className="booking-change-history__label">{itemTitle(item)}</div>
                      {diff ? (
                        <div className="booking-change-history__diff">{diff}</div>
                      ) : null}
                      {meta ? (
                        <div className="booking-change-history__meta">{meta}</div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
