import type { TouchEvent } from "react";
import { bosoHover, bosoLeave } from "./adminTooltip";
import type { BookingRecord } from "./types";

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let isLongPress = false;
let isSwiping = false;
let suppressNextClick = false;
let pressStartX = 0;
let pressStartY = 0;

/** До long-press: такий зсув = скрол, не утримання. */
export const TOUCH_PRESS_CANCEL_PX = 12;
/**
 * Після показу тултіпа: мікротремтіння пальця ігноруємо;
 * чіткий рух одразу ховає тултип (і дозволяє жест далі).
 */
export const TOUCH_TOOLTIP_HOLD_SLOP_PX = 18;

export function consumeSuppressClick(): boolean {
  if (!suppressNextClick) return false;
  suppressNextClick = false;
  return true;
}

export function resetTimelineTouchState(): void {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
  isLongPress = false;
  isSwiping = false;
  pressStartX = 0;
  pressStartY = 0;
}

export function handleBookingTouchStart(
  e: TouchEvent<HTMLElement>,
  element: HTMLElement,
  bookingKey: string | number,
  type: "main" | "early" | "late" | "postlate" = "main",
  bookingHint?: BookingRecord | null
): void {
  if (String(bookingKey).startsWith("temp_")) return;

  const t = e.touches[0];
  pressStartX = t?.clientX ?? 0;
  pressStartY = t?.clientY ?? 0;
  isLongPress = false;
  isSwiping = false;
  element.classList.add("pressing");
  bosoLeave();

  pressTimer = setTimeout(() => {
    isLongPress = true;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
    bosoHover(element, bookingKey, type, bookingHint);
  }, 400);
}

export function handleBookingTouchMove(
  e: TouchEvent<HTMLElement>,
  element: HTMLElement
): void {
  const t = e.touches[0];
  if (!t) return;
  const dist = Math.hypot(t.clientX - pressStartX, t.clientY - pressStartY);

  if (!isLongPress) {
    if (dist < TOUCH_PRESS_CANCEL_PX) return;
    isSwiping = true;
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
    element.classList.remove("pressing");
    return;
  }

  // Тултип уже на екрані — тримаємо при мікрорусі, ховаємо при явному жесті.
  if (dist < TOUCH_TOOLTIP_HOLD_SLOP_PX) return;
  isSwiping = true;
  bosoLeave();
  element.classList.remove("pressing");
}

export function handleBookingTouchEnd(
  e: TouchEvent<HTMLElement>,
  element: HTMLElement,
  rowId: string | number,
  onOpen: () => void
): void {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
  element.classList.remove("pressing");

  if (isLongPress) {
    if (e.cancelable) e.preventDefault();
    return;
  }
  if (!isSwiping) {
    bosoLeave();
    suppressNextClick = true;
    onOpen();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "touchstart",
    (e) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".booking-block") && !t.closest("#boso-tooltip")) {
        bosoLeave();
      }
    },
    { passive: true }
  );
}
