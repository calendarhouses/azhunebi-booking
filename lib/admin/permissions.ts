/** Ролі адмінки: власник (усе) / адміністратор (операційна робота). */
export type AdminRole = "owner" | "admin";

export const TEAM_MAX_MEMBERS = 5;

export function normalizeAdminRole(role: unknown): AdminRole {
  return role === "admin" ? "admin" : "owner";
}

export function isOwnerRole(role: unknown): boolean {
  return normalizeAdminRole(role) === "owner";
}

export function canAccessReports(role: unknown): boolean {
  return role === "owner";
}

export function canAccessSettings(role: unknown): boolean {
  return role === "owner";
}

export function canManageTeam(role: unknown): boolean {
  return role === "owner";
}

/** Шахматка, усі броні, гості — обидві ролі. */
export function canAccessOperations(role: unknown): boolean {
  return normalizeAdminRole(role) === "owner" || normalizeAdminRole(role) === "admin";
}

export function roleLabelUk(role: unknown): string {
  return normalizeAdminRole(role) === "admin" ? "Адміністратор" : "Власник";
}
