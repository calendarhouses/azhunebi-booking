"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import type { BookingPayment } from "./types";
import { createFlatpickr, type FlatpickrInstance } from "./flatpickrAdmin";
import { closeCustomConfirm, openCustomConfirm } from "./reports/confirmDialog";
import { formatDateIso } from "@/lib/admin/bookingPayments";
import { IntegerAmountInput } from "../shared/IntegerAmountInput";
import { parseIntegerAmountInput } from "@/lib/admin/integerAmountInput";

const METHOD_OPTS = [
  { value: "ФОП", label: "ФОП" },
  { value: "Картка", label: "Картка" },
  { value: "Готівка", label: "Готівка" },
];

const TYPE_OPTS = [
  { value: "prepay", label: "Аванс" },
  { value: "surcharge", label: "Доплата" },
  { value: "refund", label: "Повернення" },
];

type SelectOption = { value: string; label: string };

function formatDateLabel(iso: string): string {
  const parts = String(iso || "").substring(0, 10).split("-");
  if (parts.length !== 3) return "без дати";
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function PaymentJournalSelect({
  selectKey,
  open,
  onToggle,
  value,
  options,
  onChange,
}: {
  selectKey: string;
  open: boolean;
  onToggle: (key: string | null) => void;
  value: string;
  options: SelectOption[];
  onChange: (val: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const current = options.find((o) => o.value === value) || options[0];

  const repositionMenu = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight || 180;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 12;
    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: rect.width,
      zIndex: 4000,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    repositionMenu();
    requestAnimationFrame(repositionMenu);
    window.addEventListener("resize", repositionMenu);
    window.addEventListener("scroll", repositionMenu, true);
    return () => {
      window.removeEventListener("resize", repositionMenu);
      window.removeEventListener("scroll", repositionMenu, true);
    };
  }, [open, repositionMenu]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onToggle(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onToggle]);

  const pick = (opt: SelectOption) => {
    onChange(opt.value);
    onToggle(null);
  };

  const menu =
    open && menuStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="custom-select-options pj-dd-menu"
            style={menuStyle}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`custom-option${opt.value === value ? " selected" : ""}`}
                onClick={() => pick(opt)}
              >
                {opt.label}
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={wrapRef}
        className={`custom-select-wrapper pj-dd${open ? " open" : ""}`}
      >
        <div
          className="custom-select-trigger"
          onClick={() => onToggle(open ? null : selectKey)}
        >
          <span className="pj-dd-label">{current.label}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>
      {menu}
    </>
  );
}

function PaymentJournalDateField({
  date,
  onChange,
}: {
  date: string;
  onChange: (iso: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<FlatpickrInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const fp = createFlatpickr(el, {
      locale: "uk",
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d.m.Y",
      altInputClass: "pj-date-alt",
      allowInput: false,
      disableMobile: true,
      clickOpens: false,
      defaultDate: date || undefined,
      onChange: (selectedDates, dateStr) => {
        const iso =
          selectedDates[0] != null
            ? formatDateIso(selectedDates[0])
            : String(dateStr || "").substring(0, 10);
        if (iso) onChangeRef.current(iso);
      },
      onReady: (_dates, _dateStr, inst) => {
        const target = inst.altInput;
        if (!target) return;
        target.addEventListener("mousedown", (e) => {
          e.preventDefault();
          inst.toggle();
        });
      },
    });
    fpRef.current = fp;

    return () => {
      try {
        fp.destroy();
      } catch {
        /* ignore */
      }
      fpRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!fpRef.current || !date) return;
    const current = fpRef.current.selectedDates[0];
    const iso = String(date).substring(0, 10);
    if (!current || fpRef.current.formatDate(current, "Y-m-d") !== iso) {
      fpRef.current.setDate(iso, false);
    }
  }, [date]);

  return (
    <div className="pj-date-wrap">
      <input ref={inputRef} type="text" className="pj-date-input" tabIndex={-1} aria-hidden readOnly />
    </div>
  );
}

type PaymentJournalSectionProps = {
  payments: BookingPayment[];
  onChange: (payments: BookingPayment[]) => void;
  defaultMethod?: string;
};

export function PaymentJournalSection({
  payments,
  onChange,
  defaultMethod = "ФОП",
}: PaymentJournalSectionProps) {
  const [openSelectKey, setOpenSelectKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const updateField = useCallback(
    (idx: number, field: keyof BookingPayment, val: string | number) => {
      onChange(
        payments.map((p, i) => {
          if (i !== idx) return p;
          if (field === "amount") {
            return {
              ...p,
              amount: Math.round(
                typeof val === "number" ? val : parseIntegerAmountInput(String(val), true)
              ),
            };
          }
          return { ...p, [field]: val };
        })
      );
    },
    [onChange, payments]
  );

  const addRow = () => {
    setOpen(true);
    onChange([
      ...payments,
      {
        id: `P-${Date.now()}`,
        date: formatDateIso(new Date()),
        amount: 0,
        method: defaultMethod,
        type: "prepay",
        note: "",
      },
    ]);
  };

  const removeRow = (idx: number) => {
    onChange(payments.filter((_, i) => i !== idx));
  };

  const confirmRemove = (idx: number) => {
    const p = payments[idx];
    if (!p) return;
    const amt = Math.round(Number(p.amount) || 0);
    const dateLabel = formatDateLabel(String(p.date || ""));
    const amtLabel = amt !== 0 ? ` на ${amt.toLocaleString("uk-UA")} грн` : "";
    openCustomConfirm(
      "Видалити платіж?",
      `Запис від ${dateLabel}${amtLabel} буде прибрано з журналу. Натисни «Зберегти бронь», щоб застосувати зміни.`,
      () => {
        closeCustomConfirm();
        removeRow(idx);
      }
    );
  };

  const count = payments.length;

  return (
    <div className={`payment-journal${open ? " is-open" : ""}`}>
      <div className="payment-journal-head">
        <button
          type="button"
          className="payment-journal-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="payment-journal-title-wrap">
            <span className="payment-journal-title">Журнал платежів</span>
            {count > 0 ? (
              <span className="payment-journal-badge" aria-label={`${count} платежів`}>
                {count}
              </span>
            ) : null}
          </span>
          <ChevronDown
            size={18}
            strokeWidth={2}
            className={`payment-journal-chevron${open ? " payment-journal-chevron--open" : ""}`}
            aria-hidden
          />
        </button>
        {open ? (
          <button type="button" className="pj-add-btn" onClick={addRow}>
            + Платіж
          </button>
        ) : null}
      </div>
      {open ? (
      <div id="paymentJournalList" className="payment-journal-body">
        {!payments.length ? (
          <div className="pj-empty">
            Немає записів — натисни «+ Платіж» або вкажи аванс / доплату вище.
          </div>
        ) : (
          <div className="pj-table">
            <div className="pj-thead">
              <span>Дата</span>
              <span>Сума</span>
              <span>Метод</span>
              <span>Тип</span>
              <span />
            </div>
            {payments.map((p, idx) => {
              const neg = Number(p.amount) < 0;
              const dateVal = String(p.date || "").substring(0, 10);
              const rowKey = p.id || `row-${idx}`;
              return (
                <div className="pj-row" key={rowKey}>
                  <PaymentJournalDateField
                    date={dateVal}
                    onChange={(iso) => updateField(idx, "date", iso)}
                  />
                  <IntegerAmountInput
                    className={`pj-field pj-amount${neg ? " pj-amount-negative" : ""}`}
                    value={Number(p.amount) || 0}
                    allowNegative
                    onValueChange={(n) => updateField(idx, "amount", n)}
                  />
                  <PaymentJournalSelect
                    selectKey={`${rowKey}-method`}
                    open={openSelectKey === `${rowKey}-method`}
                    onToggle={setOpenSelectKey}
                    value={p.method || "ФОП"}
                    options={METHOD_OPTS}
                    onChange={(val) => updateField(idx, "method", val)}
                  />
                  <PaymentJournalSelect
                    selectKey={`${rowKey}-type`}
                    open={openSelectKey === `${rowKey}-type`}
                    onToggle={setOpenSelectKey}
                    value={p.type || "prepay"}
                    options={TYPE_OPTS}
                    onChange={(val) => updateField(idx, "type", val)}
                  />
                  <button
                    type="button"
                    className="pj-del"
                    onClick={() => confirmRemove(idx)}
                    title="Видалити"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      ) : null}
    </div>
  );
}
