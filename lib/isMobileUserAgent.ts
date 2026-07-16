/** Shared UA check — same pattern as public `/book/[tenant_id]`. */
export function isMobileUserAgent(ua: string | null | undefined): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    ua || ""
  );
}
