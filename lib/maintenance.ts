/**
 * Site-wide pause for public + admin UI.
 * Set MAINTENANCE_MODE=false on Vercel to reopen.
 * Default: ON (while migrating / paused for guests).
 */
export function isMaintenanceMode(): boolean {
  const v = process.env.MAINTENANCE_MODE?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  return true;
}
