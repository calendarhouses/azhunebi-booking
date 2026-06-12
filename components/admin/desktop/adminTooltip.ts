import { formatPhone, parseSafeDate } from "./adminDates";
import { getGuestWord } from "./adminPlural";
import type { BookingRecord } from "./types";

/** Скасовує відкладене показування після bosoLeave / нового hover. */
let showGeneration = 0;
let showFrameId: number | null = null;
let pointerCheckFrame: number | null = null;
/** Блок броні, з якого відкрили тултип (для «коридору» до картки над ним). */
let hoverAnchor: HTMLElement | null = null;

const DISMISS_POINTER_ROOT = ".sidebar, .bottom-nav, .header, .drawer-overlay, .modal-overlay";

function isPointInRect(x: number, y: number, rect: DOMRect, padding = 0): boolean {
  return (
    x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding
  );
}

function shouldKeepTooltipVisible(clientX: number, clientY: number): boolean {
  const hit = document.elementFromPoint(clientX, clientY);
  if (hit?.closest(DISMISS_POINTER_ROOT)) return false;

  const block = hit?.closest(".booking-block");
  if (block && !block.classList.contains("restriction-chip")) return true;

  if (hoverAnchor?.isConnected && isPointInRect(clientX, clientY, hoverAnchor.getBoundingClientRect(), 6)) {
    return true;
  }

  const tt = document.getElementById("boso-tooltip");
  if (tt?.classList.contains("show")) {
    const ttRect = tt.getBoundingClientRect();
    if (isPointInRect(clientX, clientY, ttRect, 10)) return true;
  }

  return false;
}

function syncTooltipWithPointer(clientX: number, clientY: number): void {
  const tt = document.getElementById("boso-tooltip");
  if (!tt?.classList.contains("show")) return;
  if (!shouldKeepTooltipVisible(clientX, clientY)) {
    bosoLeave();
  }
}

function schedulePointerCheck(e: PointerEvent | MouseEvent): void {
  if (pointerCheckFrame !== null) return;
  const { clientX, clientY } = e;
  pointerCheckFrame = requestAnimationFrame(() => {
    pointerCheckFrame = null;
    syncTooltipWithPointer(clientX, clientY);
  });
}

export function bosoLeave(): void {
  showGeneration += 1;
  hoverAnchor = null;
  if (showFrameId !== null) {
    cancelAnimationFrame(showFrameId);
    showFrameId = null;
  }
  document.querySelectorAll("#boso-tooltip").forEach((el) => {
    el.classList.remove("show");
  });
}

export function bosoHover(
  element: HTMLElement,
  rowId: string | number,
  type: "main" | "early" | "late" = "main"
): void {
  hoverAnchor = element;
  const bookings = (window as Window & { allBookings?: BookingRecord[] }).allBookings || [];
  const b = bookings.find((x) => String(x.row) === String(rowId));
  if (!b) return;

  let tt = document.getElementById("boso-tooltip");
  if (!tt) {
    tt = document.createElement("div");
    tt.id = "boso-tooltip";
    document.body.appendChild(tt);
  }

  let inDate = "—";
  let outDate = "—";
  try {
    if (b.checkIn) inDate = parseSafeDate(String(b.checkIn)).toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
    if (b.checkOut) outDate = parseSafeDate(String(b.checkOut)).toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
  } catch {
    /* ignore */
  }

  const name = b.name ? String(b.name).replace(" (Ручна бронь)", "") : "Клієнт";
  const guests = b.guests || 2;
  const room = b.cottage || "—";
  const total = Number(b.totalPrice) || 0;
  const paid = Number(b.paidAmount) || 0;
  const balance = total - paid;
  const rawComment = b.comment ? String(b.comment).trim() : "";

  if (type === "early" || type === "late") {
    let timeText = "";
    const iconClock =
      '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right: 6px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
    if (type === "early") {
      const m = rawComment.match(/🕒 Ранній заїзд: з (\d{2}:\d{2})/);
      timeText = m ? `Заїзд з ${m[1]}` : "Ранній заїзд";
    } else {
      const m = rawComment.match(/🕒 Пізній виїзд: до (\d{2}:\d{2})/);
      timeText = m ? `Виїзд до ${m[1]}` : "Акційний виїзд (до 14:00)";
    }
    tt.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:4px;font-weight:700;color:#111827;font-size:13px;">${iconClock}${timeText}</div>`;
    tt.style.width = "auto";
    tt.style.minWidth = "140px";
  } else {
    tt.style.width = "260px";
    let statusHtml = "";
    const sClass = String(b.status).toLowerCase();
    if (sClass.includes("скас")) {
      statusHtml = `<div class="bt-status gray">Скасовано</div>`;
    } else if (total === 0) {
      statusHtml = `<div class="bt-status gray">Очікує ціни</div>`;
    } else if (balance <= 0) {
      statusHtml = `<div class="bt-status green">Оплачено повністю</div>`;
    } else if (paid > 0) {
      statusHtml = `<div class="bt-status red">Залишок до сплати: ${balance} грн</div>`;
    } else {
      statusHtml = `<div class="bt-status yellow">Очікує аванс: ${Math.round(total / 2)} грн</div>`;
    }

    const phone = formatPhone(String(b.phone || ""));
    tt.innerHTML = `
      <div class="bt-head">
        <span class="bt-name">${name}</span>
        <span class="bt-guests">${guests} ${getGuestWord(Number(guests))}</span>
      </div>
      <div class="bt-row"><span class="bt-label">Котедж:</span> <span class="bt-val">${room}</span></div>
      <div class="bt-row"><span class="bt-label">Дати:</span> <span class="bt-val" style="color:var(--accent);">${inDate} — ${outDate}</span></div>
      <div class="bt-row"><span class="bt-label">Сума:</span> <span class="bt-val">${total} грн</span></div>
      <div class="bt-row"><span class="bt-label">Внесено:</span> <span class="bt-val green">${paid} грн</span></div>
      ${statusHtml}
    `;
  }

  const targetRect = element.getBoundingClientRect();
  const generation = showGeneration;
  if (showFrameId !== null) {
    cancelAnimationFrame(showFrameId);
  }
  showFrameId = requestAnimationFrame(() => {
    showFrameId = null;
    if (generation !== showGeneration) return;
    const ttEl = document.getElementById("boso-tooltip");
    if (!ttEl) return;
    const ttHeight = ttEl.offsetHeight;
    const ttWidth = ttEl.offsetWidth;
    const gap = 12;
    let leftPos = targetRect.left + targetRect.width / 2 - ttWidth / 2;
    let topPos = 0;

    if (targetRect.top - ttHeight - gap >= 10) {
      topPos = targetRect.top - ttHeight - gap;
    } else if (targetRect.bottom + ttHeight + gap <= window.innerHeight - 10) {
      topPos = targetRect.bottom + gap;
    } else {
      topPos = targetRect.bottom + gap;
    }

    leftPos = Math.max(10, Math.min(leftPos, window.innerWidth - ttWidth - 10));
    topPos = Math.max(10, Math.min(topPos, window.innerHeight - ttHeight - 10));
    ttEl.style.top = `${topPos}px`;
    ttEl.style.left = `${leftPos}px`;
    if (generation !== showGeneration) return;
    ttEl.classList.add("show");
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("pointermove", schedulePointerCheck, { passive: true });
  document.addEventListener("mousemove", schedulePointerCheck, { passive: true });
  document.addEventListener(
    "pointerdown",
    (e) => {
      const tt = document.getElementById("boso-tooltip");
      if (!tt?.classList.contains("show")) return;
      if (!shouldKeepTooltipVisible(e.clientX, e.clientY)) {
        bosoLeave();
      }
    },
    { passive: true }
  );
  document.addEventListener("mouseout", (e) => {
    if (e.relatedTarget != null) return;
    bosoLeave();
  });
}
