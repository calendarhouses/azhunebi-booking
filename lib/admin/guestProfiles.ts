import { formatPhone } from "@/components/admin/desktop/adminDates";
import type { AdminSettingsPayload } from "@/components/admin/desktop/types";

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

export function upsertGuestProfileInSettings(
  settings: AdminSettingsPayload,
  rawPhone: string,
  patch: { rating?: GuestRating | null; note?: string | null }
): AdminSettingsPayload {
  const key = guestPhoneKey(rawPhone);
  if (!key) return settings;

  const prevMap: GuestProfilesMap =
    settings.guestProfiles && typeof settings.guestProfiles === "object"
      ? { ...settings.guestProfiles }
      : {};
  const prev = prevMap[key] || {};
  const next: GuestProfile = {
    ...prev,
    updatedAt: new Date().toISOString(),
  };
  if ("rating" in patch) {
    if (patch.rating === 1 || patch.rating === 2 || patch.rating === 3) {
      next.rating = patch.rating;
    } else {
      delete next.rating;
    }
  }
  if ("note" in patch) {
    const note = String(patch.note || "").trim().slice(0, 2000);
    if (note) next.note = note;
    else delete next.note;
  }

  prevMap[key] = next;
  return { ...settings, guestProfiles: prevMap };
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
