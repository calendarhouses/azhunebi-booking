/**
 * Site-wide pause for public + admin UI.
 * ON only when explicitly enabled (true/1/on/yes).
 * After cutover, Production should leave this unset or false.
 */
export function isMaintenanceMode(): boolean {
  const v = process.env.MAINTENANCE_MODE?.trim().toLowerCase().replace(/^["']|["']$/g, "");
  return v === "true" || v === "1" || v === "on" || v === "yes";
}
