import { getDb } from "@/lib/db/mappers";

export type GuestProfile = {
  rating?: number | null;
  note?: string;
  updatedAt?: string;
};

function digits(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

export async function getGuestProfilesMap(): Promise<Record<string, GuestProfile>> {
  const sb = getDb();
  const { data, error } = await sb.from("guest_profiles").select("*");
  if (error) throw new Error(`getGuestProfiles: ${error.message}`);

  const out: Record<string, GuestProfile> = {};
  for (const row of data || []) {
    const phone = digits(String(row.phone || ""));
    if (!phone) continue;
    out[phone] = {
      rating: row.rating == null ? null : Number(row.rating),
      note: row.note != null ? String(row.note) : "",
      updatedAt: row.updated_at ? String(row.updated_at) : undefined,
    };
  }

  // Fallback: settings.guestProfiles blob from migrate
  if (!Object.keys(out).length) {
    const { data: setting } = await sb
      .from("settings")
      .select("value")
      .eq("key", "guestProfiles")
      .maybeSingle();
    if (setting?.value && typeof setting.value === "object") {
      return setting.value as Record<string, GuestProfile>;
    }
  }
  return out;
}

export async function saveGuestProfile(params: {
  phone: string;
  rating?: number | null;
  note?: string | null;
}): Promise<GuestProfile | null> {
  const phone = digits(params.phone);
  if (!phone) throw new Error("phone required");

  const rating =
    params.rating == null || params.rating === ("" as unknown)
      ? null
      : Math.round(Number(params.rating));
  const note = params.note != null ? String(params.note).slice(0, 500) : "";
  const sb = getDb();

  if ((rating == null || !Number.isFinite(rating)) && !note) {
    await sb.from("guest_profiles").delete().eq("phone", phone);
    return null;
  }

  const updated_at = new Date().toISOString();
  const { error } = await sb.from("guest_profiles").upsert(
    {
      phone,
      rating: Number.isFinite(rating as number) ? rating : null,
      note: note || null,
      updated_at,
    },
    { onConflict: "phone" }
  );
  if (error) throw new Error(`saveGuestProfile: ${error.message}`);
  return {
    rating: Number.isFinite(rating as number) ? (rating as number) : null,
    note,
    updatedAt: updated_at,
  };
}

/** One-shot: copy settings.guestProfiles → guest_profiles table. */
export async function hydrateGuestProfilesFromSettings(): Promise<number> {
  const sb = getDb();
  const { data: setting } = await sb
    .from("settings")
    .select("value")
    .eq("key", "guestProfiles")
    .maybeSingle();
  if (!setting?.value || typeof setting.value !== "object") return 0;
  const map = setting.value as Record<string, GuestProfile>;
  let n = 0;
  for (const [phoneRaw, p] of Object.entries(map)) {
    const phone = digits(phoneRaw);
    if (!phone) continue;
    await saveGuestProfile({
      phone,
      rating: p?.rating ?? null,
      note: p?.note ?? "",
    });
    n += 1;
  }
  return n;
}
