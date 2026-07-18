export type PublicToastVariant = "info" | "warn";

/** Strip HTML tags for plain-text UI (buttons, aria, etc.). */
export function stripHtmlTags(html: string): string {
  return String(html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Escape HTML, then re-enable only <b>/<B> so emphasis from overlap reasons
 * renders without exposing raw tags or other markup.
 */
export function toSafePublicRichHtml(html: string): string {
  return String(html || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?b)&gt;/gi, "<$1>");
}

export function showPublicToast(
  msg: string,
  opts?: { variant?: PublicToastVariant; durationMs?: number }
) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("toast");
  if (!el) return;

  const variant = opts?.variant ?? "info";
  const duration = opts?.durationMs ?? 3600;
  const hasEmphasis = /<\/?b>/i.test(msg);

  el.classList.remove("toast--warn", "toast--info");
  el.classList.add(variant === "warn" ? "toast--warn" : "toast--info");

  if (hasEmphasis) {
    el.innerHTML = toSafePublicRichHtml(msg);
  } else {
    el.textContent = stripHtmlTags(msg);
  }

  el.classList.add("show");
  window.clearTimeout((el as HTMLElement & { _toastTimer?: number })._toastTimer);
  (el as HTMLElement & { _toastTimer?: number })._toastTimer = window.setTimeout(() => {
    el.classList.remove("show");
  }, duration);
}
