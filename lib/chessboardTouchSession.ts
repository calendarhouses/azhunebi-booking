/**
 * Strict touch-session helpers for mobile chessboards.
 *
 * Android Chrome often fires pointercancel while the finger is still down,
 * OR after the finger has left. Soft-ignoring cancel without checking live
 * touches creates "zombie" selections that arm / finish by themselves.
 */

type ActiveTouch = { x: number; y: number };

const activeTouches = new Map<number, ActiveTouch>();
let trackingInstalled = false;

function ingestTouches(list: TouchList, mode: "upsert" | "remove") {
  for (let i = 0; i < list.length; i++) {
    const t = list.item(i);
    if (!t) continue;
    if (mode === "remove") {
      activeTouches.delete(t.identifier);
    } else {
      activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
  }
}

/** Install once — keeps a live map of fingers currently on screen. */
export function ensureChessboardTouchTracking() {
  if (typeof document === "undefined" || trackingInstalled) return;
  trackingInstalled = true;
  const opts: AddEventListenerOptions = { capture: true, passive: true };
  document.addEventListener(
    "touchstart",
    (e) => ingestTouches(e.changedTouches, "upsert"),
    opts
  );
  document.addEventListener(
    "touchmove",
    (e) => ingestTouches(e.touches, "upsert"),
    opts
  );
  document.addEventListener(
    "touchend",
    (e) => ingestTouches(e.changedTouches, "remove"),
    opts
  );
  document.addEventListener(
    "touchcancel",
    (e) => ingestTouches(e.changedTouches, "remove"),
    opts
  );
}

export function isTouchIdDown(touchId: number | null | undefined): boolean {
  if (touchId == null) return false;
  return activeTouches.has(touchId);
}

export function touchFromList(
  list: TouchList,
  touchId: number | null | undefined
): Touch | null {
  if (touchId == null) return null;
  for (let i = 0; i < list.length; i++) {
    const t = list.item(i);
    if (t && t.identifier === touchId) return t;
  }
  return null;
}

export function changedTouchMatches(
  event: TouchEvent,
  touchId: number | null | undefined
): boolean {
  return touchFromList(event.changedTouches, touchId) != null;
}

/**
 * Best-effort: match a Touch.identifier to a pointerdown by proximity.
 * Call right after pointerdown. On Chrome Android pointerdown precedes touchstart,
 * so prefer `bindTouchIdWhenReady` when the first lookup returns null.
 */
export function resolveTouchIdNear(clientX: number, clientY: number): number | null {
  ensureChessboardTouchTracking();
  let bestId: number | null = null;
  let bestDist = 36; // px — finger + chrome jitter
  for (const [id, pos] of activeTouches) {
    const d = Math.hypot(pos.x - clientX, pos.y - clientY);
    if (d <= bestDist) {
      bestDist = d;
      bestId = id;
    }
  }
  return bestId;
}

/**
 * pointerdown often races ahead of touchstart on Android. Resolve touchId on the
 * next macrotask so the live-touch map is populated.
 */
export function bindTouchIdWhenReady(
  clientX: number,
  clientY: number,
  assign: (touchId: number | null) => void
): void {
  const immediate = resolveTouchIdNear(clientX, clientY);
  if (immediate != null) {
    assign(immediate);
    return;
  }
  setTimeout(() => {
    assign(resolveTouchIdNear(clientX, clientY));
  }, 0);
}

/** True if this pointercancel should keep the session (finger still on screen). */
export function shouldSoftKeepAfterPointerCancel(
  touchId: number | null | undefined
): boolean {
  if (touchId == null) return false;
  return isTouchIdDown(touchId);
}

/** True if a hold timer is still allowed to arm the gesture. */
export function canArmTouchGesture(
  touchId: number | null | undefined,
  isTouchGesture: boolean
): boolean {
  if (!isTouchGesture) return true;
  // Must be bound to a live finger — otherwise Android zombies re-arm after cancel.
  if (touchId == null) return false;
  return isTouchIdDown(touchId);
}
