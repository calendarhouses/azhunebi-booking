/**
 * Per-booking change_history entries — parity with azhunebi-script/activity.js
 * (buildBookingUpdateChanges / buildBookingCreateChanges / buildNextBookingChangeHistory_).
 */

import type { ApiBooking } from "@/lib/db/mappers";

export type BookingChangeLine = {
  label: string;
  from: string;
  to: string;
};

export type BookingActivityEntry = {
  id: string;
  at: string;
  type: string;
  label: string;
  from: string;
  to: string;
  actorName: string;
  summary: string;
};

const CHANGES_MAX = 20;
const HISTORY_MAX = 80;

function activityStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toLocaleDateString("sv-SE", { timeZone: "Europe/Kyiv" });
  }
  return String(v).trim();
}

function normMoney(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function formatMoney(v: unknown): string {
  const s = String(normMoney(v));
  let out = "";
  let i = s.length;
  while (i > 3) {
    out = ` ${s.slice(i - 3, i)}${out}`;
    i -= 3;
  }
  return `${s.slice(0, i)}${out} ₴`;
}

function pushChange(
  changes: BookingChangeLine[],
  label: string,
  fromVal: unknown,
  toVal: unknown,
  opts?: { money?: boolean; force?: boolean }
) {
  if (!label || changes.length >= CHANGES_MAX) return;
  let fromS: string;
  let toS: string;
  if (opts?.money) {
    if (!opts.force && normMoney(fromVal) === normMoney(toVal)) return;
    fromS =
      fromVal == null || fromVal === "" ? "—" : formatMoney(fromVal);
    toS = toVal == null || toVal === "" ? "—" : formatMoney(toVal);
  } else {
    fromS = activityStr(fromVal);
    toS = activityStr(toVal);
    if (!opts?.force && fromS === toS) return;
    if (!fromS) fromS = "—";
    if (!toS) toS = "—";
  }
  changes.push({
    label: label.slice(0, 80),
    from: fromS.slice(0, 160),
    to: toS.slice(0, 160),
  });
}

function pushFact(
  changes: BookingChangeLine[],
  label: string,
  toVal: unknown,
  opts?: { money?: boolean }
) {
  if (!label || changes.length >= CHANGES_MAX) return;
  const toS = opts?.money
    ? formatMoney(toVal)
    : activityStr(toVal) || "—";
  changes.push({
    label: label.slice(0, 80),
    from: "",
    to: toS.slice(0, 160),
  });
}

export function buildBookingUpdateChanges(
  prev: ApiBooking | null | undefined,
  next: ApiBooking
): BookingChangeLine[] {
  const changes: BookingChangeLine[] = [];
  if (!prev) return changes;

  pushChange(changes, "Статус", prev.status, next.status);
  pushChange(
    changes,
    "Житло",
    prev.cottage || prev.roomName,
    next.cottage || next.roomName
  );
  pushChange(changes, "Гість", prev.name, next.name);
  pushChange(changes, "Телефон", prev.phone, next.phone);

  const oldIn = activityStr(prev.checkIn);
  const oldOut = activityStr(prev.checkOut);
  const newIn = activityStr(next.checkIn);
  const newOut = activityStr(next.checkOut);
  if (oldIn !== newIn || oldOut !== newOut) {
    pushChange(
      changes,
      "Дати",
      `${oldIn || "—"} → ${oldOut || "—"}`,
      `${newIn || "—"} → ${newOut || "—"}`,
      { force: true }
    );
  }

  pushChange(changes, "Гості", prev.guests, next.guests);
  pushChange(changes, "Сума", prev.totalPrice, next.totalPrice, { money: true });
  pushChange(changes, "Оплачено", prev.paidAmount, next.paidAmount, {
    money: true,
  });
  pushChange(changes, "Аванс", prev.prepayAmount, next.prepayAmount, {
    money: true,
  });
  pushChange(changes, "Знижка", prev.discountAmount, next.discountAmount, {
    money: true,
  });
  pushChange(changes, "База", prev.basePrice, next.basePrice, { money: true });
  pushChange(changes, "Доплата", prev.surchargeAmount, next.surchargeAmount, {
    money: true,
  });

  const prevAssign = activityStr(prev.assignmentState || "assigned");
  const nextAssign = activityStr(next.assignmentState || "assigned");
  if (prevAssign !== nextAssign) {
    pushChange(
      changes,
      "Розподіл",
      prevAssign === "holding" ? "Нерозподілені" : prevAssign,
      nextAssign === "holding" ? "Нерозподілені" : nextAssign,
      { force: true }
    );
  }

  return changes;
}

export function buildBookingCreateChanges(data: ApiBooking): BookingChangeLine[] {
  const changes: BookingChangeLine[] = [];
  pushFact(changes, "Житло", data.cottage || data.roomName || "—");
  pushFact(changes, "Гість", data.name || "—");
  if (data.checkIn || data.checkOut) {
    pushFact(
      changes,
      "Дати",
      `${activityStr(data.checkIn || "—")} → ${activityStr(data.checkOut || "—")}`
    );
  }
  if (data.status) pushFact(changes, "Статус", data.status);
  if (data.totalPrice != null && data.totalPrice !== "") {
    pushFact(changes, "Сума", data.totalPrice, { money: true });
  }
  if (data.paidAmount != null && data.paidAmount !== "") {
    pushFact(changes, "Оплачено", data.paidAmount, { money: true });
  }
  if (data.prepayAmount != null && data.prepayAmount !== "") {
    pushFact(changes, "Аванс", data.prepayAmount, { money: true });
  }
  if (Number(data.discountAmount) > 0) {
    pushFact(changes, "Знижка", data.discountAmount, { money: true });
  }
  return changes;
}

/** Build newest-first history entries from field diffs (GAS parity). */
export function buildHistoryEntries(params: {
  type: "booking.create" | "booking.update";
  changes: BookingChangeLine[];
  actorName: string;
  summary?: string;
  at?: string;
}): BookingActivityEntry[] {
  const at = params.at || new Date().toISOString();
  const actorName = String(params.actorName || "").trim().slice(0, 80);
  const baseId = `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const changes = params.changes || [];

  if (changes.length > 0) {
    return changes.map((ch, i) => ({
      id: `${baseId}-${i}`,
      at,
      type: params.type,
      label: String(ch.label || "").slice(0, 80),
      from: String(ch.from || "").slice(0, 160),
      to: String(ch.to || "").slice(0, 160),
      actorName,
      summary: "",
    }));
  }

  if (params.summary) {
    return [
      {
        id: baseId,
        at,
        type: params.type,
        label: "",
        from: "",
        to: "",
        actorName,
        summary: String(params.summary).slice(0, 280),
      },
    ];
  }

  return [];
}

export function mergeHistoryNewestFirst(
  existing: unknown,
  newItems: BookingActivityEntry[]
): BookingActivityEntry[] {
  const prev = Array.isArray(existing)
    ? (existing as BookingActivityEntry[])
    : [];
  if (!newItems.length) return prev.slice(0, HISTORY_MAX);
  return [...newItems, ...prev].slice(0, HISTORY_MAX);
}
