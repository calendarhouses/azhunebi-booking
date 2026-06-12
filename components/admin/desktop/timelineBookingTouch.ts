import type { TouchEvent } from "react";
import { bosoHover, bosoLeave } from "./adminTooltip";

let pressTimer: ReturnType<typeof setTimeout> | null = null;
let isLongPress = false;
let isSwiping = false;
let suppressNextClick = false;

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
}

export function handleBookingTouchStart(
  e: TouchEvent<HTMLElement>,
  element: HTMLElement,
  rowId: string | number,
  type: "main" | "early" | "late" = "main"
): void {
  if (String(rowId).startsWith("temp_")) return;

  isLongPress = false;
  isSwiping = false;
  element.classList.add("pressing");
  bosoLeave();

  pressTimer = setTimeout(() => {
    isLongPress = true;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
    bosoHover(element, rowId, type);
  }, 400);
}

export function handleBookingTouchMove(element: HTMLElement): void {
  isSwiping = true;
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = null;
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
