import { clearAdminTenantId } from "@/components/admin/desktop/adminApi";
import { GAS_AUTH_TOKEN_KEY, signOut as gasSignOut } from "@/lib/gas-api";

/** Помилка 401 від адмін-API — не ламає React, обробляється централізовано. */
export class AdminUnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;

  constructor(message = "UNAUTHORIZED") {
    super(message);
    this.name = "AdminUnauthorizedError";
  }
}

export function isAdminUnauthorizedError(err: unknown): boolean {
  if (err instanceof AdminUnauthorizedError) return true;
  if (err instanceof Error && err.message === "UNAUTHORIZED") return true;
  return false;
}

let sessionExpireInFlight = false;

/**
 * Скидає мертву сесію та редірект на /login (один раз, без циклів).
 */
export async function expireAdminSession(): Promise<void> {
  if (typeof window === "undefined" || sessionExpireInFlight) return;
  sessionExpireInFlight = true;

  clearAdminTenantId();
  document.cookie = `${GAS_AUTH_TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;

  try {
    await gasSignOut();
  } catch (e) {
    console.error("[expireAdminSession] signOut failed:", e);
  }

  window.location.replace("/login");
}
