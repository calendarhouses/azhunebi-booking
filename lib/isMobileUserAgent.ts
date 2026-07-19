/** Shared UA check — same pattern as public `/book/[tenant_id]`. */
export function isMobileUserAgent(ua: string | null | undefined): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    ua || ""
  );
}

export function isAndroidUserAgent(ua: string | null | undefined): boolean {
  return /Android/i.test(ua || "");
}

export function isIOSUserAgent(ua: string | null | undefined): boolean {
  const s = ua || "";
  if (/iPhone|iPad|iPod/i.test(s)) return true;
  // iPadOS desktop UA
  if (
    typeof navigator !== "undefined" &&
    /Macintosh/i.test(s) &&
    navigator.maxTouchPoints > 1
  ) {
    return true;
  }
  return false;
}
