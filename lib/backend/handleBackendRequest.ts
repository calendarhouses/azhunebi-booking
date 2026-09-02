import "server-only";

import {
  getDataSource,
  hasGasConfig,
  hasSupabaseConfig,
  isShadowCompare,
  isSupabaseDataSource,
} from "@/lib/dataSource";
import { dispatchSupabaseAction, type DispatchResult } from "@/lib/db/dispatch";
import { mirrorGasWriteToSupabase, mirrorSupabaseWriteToGas } from "@/lib/db/dualWrite";
import { bookingsChecksum, listBookings } from "@/lib/db/bookings";
import { roomsChecksum } from "@/lib/db/rooms";
import { settingsChecksum } from "@/lib/db/settings";

const WRITE_ACTIONS = new Set([
  "createBooking",
  "createBooking(bare)",
  "deleteBooking",
  "saveSettings",
  "saveGuestProfile",
  "reviewBooking",
  "confirmBookingPayment",
  "storeMonoInvoice",
  "clearMonoPaymentAttempt",
  "expireBookingPayment",
  "recordBookingRefund",
  "markBookingSmsSent",
  "clearBookingSmsSent",
  "markPaidBookingTelegramSent",
  "syncIcalRoomBlocks",
  "patchIcalRoomMeta",
  "createTeamMember",
  "updateTeamMember",
  "appendSmsJournal",
  "syncBookingsAfterRoomRename",
  "login",
  "logout",
  "acceptTeamInvite",
  "uploadFile",
]);

export type BackendRequest = {
  method: "GET" | "POST";
  token: string | null;
  query: Record<string, string>;
  body: Record<string, unknown> | null;
  rawBody?: string;
};

function resolveAction(req: BackendRequest): string {
  if (req.query.action) return req.query.action;
  if (req.body?.action && typeof req.body.action === "string") return req.body.action;
  if (req.body?.checkIn && req.body?.name) return "createBooking(bare)";
  return "";
}

async function shadowCompareLog(): Promise<void> {
  if (!isShadowCompare() || !hasSupabaseConfig()) return;
  try {
    const [b, r, s] = await Promise.all([
      bookingsChecksum(),
      roomsChecksum(),
      settingsChecksum(),
    ]);
    console.info("[shadow-compare] supabase", {
      bookings: b.count,
      totalPriceSum: b.totalPriceSum,
      paidSum: b.paidSum,
      rooms: r.count,
      settings: s.count,
    });
  } catch (err) {
    console.warn("[shadow-compare] failed", err);
  }
}

/**
 * Unified backend entry used by /api/gas (and server-side callers).
 * Routes by DATA_SOURCE; dual-write / gas-mirror are best-effort.
 */
export async function handleBackendRequest(
  req: BackendRequest,
  gasProxy: (req: BackendRequest) => Promise<DispatchResult>
): Promise<DispatchResult> {
  const action = resolveAction(req);
  const source = getDataSource();

  if (source === "supabase") {
    if (!hasSupabaseConfig()) {
      return {
        status: 500,
        body: {
          error: "SERVER_MISCONFIGURED",
          message: "DATA_SOURCE=supabase but Supabase env is missing",
        },
      };
    }

    // Never call GAS on the request path when Supabase is primary.
    // uploadFile stores compressed images in Supabase Storage; optional GAS_MIRROR_WRITES is async only.
    const result = await dispatchSupabaseAction({
      method: req.method,
      token: req.token,
      query: req.query,
      body: req.body,
    });

    if (
      WRITE_ACTIONS.has(action) &&
      result.status < 400 &&
      result.body.success !== false &&
      !result.body.error &&
      req.body
    ) {
      // Best-effort only when GAS_MIRROR_WRITES=true; never blocks the client response.
      void mirrorSupabaseWriteToGas(action, {
        ...req.body,
        action: action === "createBooking(bare)" ? "createBooking" : action,
      });
    }

    return result;
  }

  // GAS primary
  if (!hasGasConfig()) {
    // Graceful fallback: if only Supabase is configured, use it
    if (hasSupabaseConfig()) {
      console.warn("[backend] NEXT_PUBLIC_GAS_URL missing — falling back to Supabase");
      return dispatchSupabaseAction({
        method: req.method,
        token: req.token,
        query: req.query,
        body: req.body,
      });
    }
    return {
      status: 500,
      body: {
        error: "SERVER_MISCONFIGURED",
        message: "NEXT_PUBLIC_GAS_URL is not set",
      },
    };
  }

  const result = await gasProxy(req);

  if (
    WRITE_ACTIONS.has(action) &&
    result.status < 400 &&
    result.body.success !== false &&
    !result.body.error
  ) {
    void mirrorGasWriteToSupabase(action, req.body, result.body);
  }

  if (action === "adminInitData" || action === "initData") {
    void shadowCompareLog();
  }

  return result;
}

export async function buildChecksumReport(): Promise<Record<string, unknown>> {
  const supabase = hasSupabaseConfig()
    ? {
        bookings: await bookingsChecksum(),
        rooms: await roomsChecksum(),
        settings: await settingsChecksum(),
        sampleIds: (await listBookings()).slice(0, 5).map((b) => b.id),
      }
    : null;

  return {
    ok: true,
    dataSource: getDataSource(),
    supabase,
    at: new Date().toISOString(),
  };
}
