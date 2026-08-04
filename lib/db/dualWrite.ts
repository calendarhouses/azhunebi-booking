import { isDualWriteSupabase, isGasMirrorWrites, hasGasConfig, hasSupabaseConfig } from "@/lib/dataSource";
import { upsertBooking, deleteBookingById } from "@/lib/db/bookings";
import { saveSettingsMerge } from "@/lib/db/settings";
import { saveGuestProfile } from "@/lib/db/guestProfiles";
import type { ApiBooking } from "@/lib/db/mappers";

/**
 * After a successful GAS write, mirror into Supabase (best-effort).
 */
export async function mirrorGasWriteToSupabase(
  action: string,
  payload: Record<string, unknown> | null,
  result: Record<string, unknown> | null
): Promise<void> {
  if (!isDualWriteSupabase() || !hasSupabaseConfig()) return;
  if (!payload || !result) return;
  if (result.success === false || result.error) return;

  try {
    if (
      action === "createBooking" ||
      action === "createBooking(bare)" ||
      (payload.checkIn && payload.name && !payload.action)
    ) {
      const orderId = String(result.orderId || payload.id || "");
      if (!orderId) return;
      const booking: ApiBooking = { ...payload, id: orderId };
      await upsertBooking(booking);
      return;
    }

    if (action === "deleteBooking") {
      const id = String(payload.id || "");
      if (id) await deleteBookingById(id);
      return;
    }

    if (action === "saveSettings" && payload.settings) {
      await saveSettingsMerge(
        payload.settings as Record<string, unknown>,
        Array.isArray(payload.saveKeys) ? (payload.saveKeys as string[]) : undefined
      );
      return;
    }

    if (action === "saveGuestProfile") {
      await saveGuestProfile({
        phone: String(payload.phone || ""),
        rating: payload.rating as number | null | undefined,
        note: payload.note as string | null | undefined,
      });
      return;
    }

    if (action === "reviewBooking" && result.booking) {
      await upsertBooking(result.booking as ApiBooking);
      return;
    }

    if (
      (action === "confirmBookingPayment" ||
        action === "storeMonoInvoice" ||
        action === "clearMonoPaymentAttempt" ||
        action === "expireBookingPayment" ||
        action === "recordBookingRefund" ||
        action === "markBookingSmsSent" ||
        action === "markPaidBookingTelegramSent") &&
      result.booking
    ) {
      await upsertBooking(result.booking as ApiBooking);
      return;
    }

    if (action === "syncIcalRoomBlocks") {
      // Full reconcile via migrate is safer; skip partial mirror.
      return;
    }
  } catch (err) {
    console.error("[dual-write] mirror to Supabase failed:", action, err);
  }
}

/**
 * After a successful Supabase write, best-effort mirror to GAS (hot backup).
 */
export async function mirrorSupabaseWriteToGas(
  action: string,
  payload: Record<string, unknown>
): Promise<void> {
  if (!isGasMirrorWrites() || !hasGasConfig()) return;
  const gasUrl = process.env.NEXT_PUBLIC_GAS_URL?.trim();
  if (!gasUrl) return;

  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[gas-mirror] upstream HTTP", res.status, action);
    }
  } catch (err) {
    console.error("[gas-mirror] failed:", action, err);
  }
}
