/**
 * Backend data plane switch.
 *
 * DATA_SOURCE=gas      — all reads/writes via Google Apps Script (default / safe)
 * DATA_SOURCE=supabase — reads+writes via Postgres (DAL)
 *
 * GAS_MIRROR_WRITES=true — when supabase is primary, best-effort mirror writes to GAS
 * DUAL_WRITE_SUPABASE=true — when gas is primary, best-effort mirror writes to Supabase
 * SHADOW_COMPARE=true — when gas primary, log count diffs vs Supabase (reads unaffected)
 */

export type DataSource = "gas" | "supabase";

export function getDataSource(): DataSource {
  const raw = (process.env.DATA_SOURCE || "gas").trim().toLowerCase();
  return raw === "supabase" ? "supabase" : "gas";
}

export function isSupabaseDataSource(): boolean {
  return getDataSource() === "supabase";
}

export function isGasDataSource(): boolean {
  return getDataSource() === "gas";
}

/** GAS primary → also upsert into Supabase after successful GAS writes. */
export function isDualWriteSupabase(): boolean {
  if (isSupabaseDataSource()) return false;
  const v = (process.env.DUAL_WRITE_SUPABASE || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Supabase primary → best-effort write-back to GAS. */
export function isGasMirrorWrites(): boolean {
  if (!isSupabaseDataSource()) return false;
  const v = (process.env.GAS_MIRROR_WRITES || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isShadowCompare(): boolean {
  if (!isGasDataSource()) return false;
  const v = (process.env.SHADOW_COMPARE || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function hasGasConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GAS_URL?.trim());
}
