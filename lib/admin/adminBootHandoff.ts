import type { GasSession, TenantMembership } from "@/lib/gas-api";
import { fetchAdminBoot } from "@/lib/gas-api";

export type AdminBootHandoff = {
  token: string;
  session: GasSession;
  membership: TenantMembership;
  error: string | null;
  at: number;
};

export type AdminBootResult = {
  session: GasSession | null;
  membership: TenantMembership | null;
  error: string | null;
};

let handoff: AdminBootHandoff | null = null;
/** In-flight boot shared by login warm + AuthProvider (Strict Mode safe). */
let inflightToken: string | null = null;
let inflightPromise: Promise<AdminBootResult> | null = null;

const HANDOFF_TTL_MS = 60_000;

function handoffStillValid(token: string): AdminBootHandoff | null {
  const cur = handoff;
  if (!cur) return null;
  if (cur.token !== token) return null;
  if (Date.now() - cur.at > HANDOFF_TTL_MS) return null;
  return cur;
}

export function setAdminBootHandoff(next: Omit<AdminBootHandoff, "at">): void {
  handoff = { ...next, at: Date.now() };
}

/**
 * Peek handoff without clearing — Strict Mode remount can reuse the same boot.
 * Cleared on logout via clearAdminBootHandoff.
 */
export function peekAdminBootHandoff(token: string): AdminBootHandoff | null {
  return handoffStillValid(token);
}

/** @deprecated Prefer peekAdminBootHandoff + resolveAdminBoot; kept for call-site safety. */
export function consumeAdminBootHandoff(token: string): AdminBootHandoff | null {
  return peekAdminBootHandoff(token);
}

export function clearAdminBootHandoff(): void {
  handoff = null;
  inflightToken = null;
  inflightPromise = null;
}

/**
 * Single adminBoot for login warm + AuthProvider.
 * Concurrent callers with the same token share one GAS request.
 */
export function resolveAdminBoot(token: string): Promise<AdminBootResult> {
  const ready = handoffStillValid(token);
  if (ready) {
    return Promise.resolve({
      session: ready.session,
      membership: ready.membership,
      error: ready.error,
    });
  }

  if (inflightToken === token && inflightPromise) {
    return inflightPromise;
  }

  inflightToken = token;
  inflightPromise = fetchAdminBoot(token)
    .then((boot) => {
      if (boot.session && boot.membership?.tenantId) {
        setAdminBootHandoff({
          token,
          session: boot.session,
          membership: boot.membership,
          error: boot.error,
        });
      }
      return boot;
    })
    .finally(() => {
      if (inflightToken === token) {
        inflightToken = null;
        inflightPromise = null;
      }
    });

  return inflightPromise;
}
