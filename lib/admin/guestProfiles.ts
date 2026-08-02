import { formatPhone } from "@/components/admin/desktop/adminDates";
import { gasFetch, gasPost, getStoredAuthToken } from "@/lib/gas-api";

/** 1 = bad (red), 2 = neutral (yellow), 3 = good (green) */
export type GuestRating = 1 | 2 | 3;

export type GuestProfile = {
  rating?: GuestRating;
  note?: string;
  updatedAt?: string;
};

export type GuestProfilesMap = Record<string, GuestProfile>;

export function guestPhoneKey(rawPhone: string): string {
  return formatPhone(String(rawPhone || "").trim());
}

export function getGuestProfile(
  profiles: GuestProfilesMap | null | undefined,
  rawPhone: string
): GuestProfile | null {
  const key = guestPhoneKey(rawPhone);
  if (!key || !profiles) return null;
  const p = profiles[key];
  return p && typeof p === "object" ? p : null;
}

export function guestRatingMeta(rating: GuestRating | null | undefined): {
  emoji: string;
  label: string;
  tone: "good" | "neutral" | "bad";
} | null {
  if (rating === 3) return { emoji: "😊", label: "Хороший гість", tone: "good" };
  if (rating === 2) return { emoji: "😐", label: "Нейтрально", tone: "neutral" };
  if (rating === 1) return { emoji: "😞", label: "Проблемний гість", tone: "bad" };
  return null;
}

let guestProfilesPromise: Promise<GuestProfilesMap> | null = null;
let guestProfilesResolved: GuestProfilesMap | null = null;
let guestProfilesResolvedAt = 0;
const GUEST_PROFILES_TTL_MS = 120_000;

/**
 * Guest CRM ratings live in a dedicated "GuestProfiles" sheet (one row per
 * guest), fetched lazily via a standalone action — NEVER as part of
 * adminInitData/adminBoot/settings. This is what caused the Aug 1 boot
 * outage last time (teamMembers-style JSON cell overflow); do not put this
 * data back into AdminSettingsPayload / Settings. See guestCrmRules.ts and
 * azhunebi-script/guestProfiles.js.
 */
export async function fetchGuestProfilesRemote(): Promise<GuestProfilesMap> {
  if (
    guestProfilesResolved &&
    Date.now() - guestProfilesResolvedAt < GUEST_PROFILES_TTL_MS
  ) {
    return guestProfilesResolved;
  }
  if (guestProfilesPromise) return guestProfilesPromise;

  guestProfilesPromise = (async () => {
    const data = await gasFetch<{
      profiles?: GuestProfilesMap;
      error?: string;
      message?: string;
    }>({ action: "getGuestProfiles" }, { authToken: getStoredAuthToken() });
    if (data.error) throw new Error(data.message || data.error);
    const profiles =
      data.profiles && typeof data.profiles === "object" ? data.profiles : {};
    guestProfilesResolved = profiles;
    guestProfilesResolvedAt = Date.now();
    return profiles;
  })().finally(() => {
    guestProfilesPromise = null;
  });

  return guestProfilesPromise;
}

export function clearGuestProfilesPrefetch(): void {
  guestProfilesPromise = null;
  guestProfilesResolved = null;
  guestProfilesResolvedAt = 0;
}

export async function saveGuestProfileRemote(
  rawPhone: string,
  patch: { rating?: GuestRating | null; note?: string | null }
): Promise<GuestProfile | null> {
  const phone = guestPhoneKey(rawPhone);
  if (!phone) return null;
  const data = await gasPost<{
    success?: boolean;
    profile?: GuestProfile | null;
    error?: string;
    message?: string;
  }>(
    {
      action: "saveGuestProfile",
      phone,
      rating: "rating" in patch ? patch.rating ?? null : null,
      note: "note" in patch ? patch.note ?? null : null,
    },
    { authToken: getStoredAuthToken() }
  );
  if (data.error) throw new Error(data.message || data.error);
  // Local cache may be stale after write — drop so next open refreshes.
  clearGuestProfilesPrefetch();
  return data.profile ?? null;
}
