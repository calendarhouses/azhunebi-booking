import type { GasSession, TenantMembership } from "@/lib/gas-api";

export type AdminBootHandoff = {
  token: string;
  session: GasSession;
  membership: TenantMembership;
  error: string | null;
  at: number;
};

let handoff: AdminBootHandoff | null = null;

const HANDOFF_TTL_MS = 60_000;

export function setAdminBootHandoff(next: Omit<AdminBootHandoff, "at">): void {
  handoff = { ...next, at: Date.now() };
}

/** One-shot: reuse boot from login page so AuthProvider skips a second adminBoot. */
export function consumeAdminBootHandoff(token: string): AdminBootHandoff | null {
  const cur = handoff;
  handoff = null;
  if (!cur) return null;
  if (cur.token !== token) return null;
  if (Date.now() - cur.at > HANDOFF_TTL_MS) return null;
  return cur;
}
