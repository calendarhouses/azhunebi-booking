import {
  appendChangeHistory,
  deleteBookingById,
  findOverlappingBookings,
  getBookingById,
  listBookings,
  listBookingsPublic,
  patchBookingMeta,
  upsertBooking,
} from "@/lib/db/bookings";
import {
  acceptTeamInvite,
  adminBoot,
  checkWebhookSecret,
  createTeamMember,
  getInviteInfo,
  listTeamMembersPublic,
  loginWithPassword,
  logoutToken,
  requireSession,
  updateTeamMember,
  verifyToken,
} from "@/lib/db/auth";
import { getGuestProfilesMap, saveGuestProfile } from "@/lib/db/guestProfiles";
import { listRooms } from "@/lib/db/rooms";
import { getSettingsPayload, loadAllSettings, saveSettingsMerge } from "@/lib/db/settings";
import type { ApiBooking } from "@/lib/db/mappers";
import {
  buildBookingCreateChanges,
  buildBookingUpdateChanges,
  buildHistoryEntries,
} from "@/lib/db/bookingChangeHistory";

export type DispatchContext = {
  method: "GET" | "POST";
  token: string | null;
  query: Record<string, string>;
  body: Record<string, unknown> | null;
};

export type DispatchResult = {
  status: number;
  body: Record<string, unknown>;
};

function ok(body: Record<string, unknown>, status = 200): DispatchResult {
  return { status, body };
}

function fail(message: string, status = 400, error = "ERROR"): DispatchResult {
  return { status, body: { error, message, success: false } };
}

function extractToken(ctx: DispatchContext): string | null {
  if (ctx.token) return ctx.token;
  if (ctx.body?.accessToken) return String(ctx.body.accessToken);
  if (ctx.query.token) return ctx.query.token;
  if (ctx.query.accessToken) return ctx.query.accessToken;
  return null;
}

function actionName(ctx: DispatchContext): string {
  if (ctx.query.action) return ctx.query.action;
  if (ctx.body?.action && typeof ctx.body.action === "string") return ctx.body.action;
  if (ctx.body?.checkIn && ctx.body?.name) return "createBooking";
  return "";
}

function addHoursIso(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

async function paymentWindowHoursFromSettings(): Promise<number> {
  const { resolvePaymentWindowHours } = await import("@/lib/payment/paymentSettings");
  const all = await loadAllSettings();
  return resolvePaymentWindowHours(all.paymentSettings);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn);
  const b = Date.parse(checkOut);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

async function resolveRoomId(payload: Record<string, unknown>): Promise<string | null> {
  if (payload.roomId != null && String(payload.roomId).trim() !== "") {
    return String(payload.roomId);
  }
  const cottage = String(payload.cottage || "").trim();
  if (!cottage) return null;
  const rooms = await listRooms();
  const match = rooms.find(
    (r) =>
      String(r.name || "").trim() === cottage ||
      String(r.short || "").trim() === cottage
  );
  return match ? String(match.id) : null;
}

async function handleCreateBooking(
  payload: Record<string, unknown>,
  token: string | null
): Promise<DispatchResult> {
  const source = String(payload.source || "Адмінка");
  // Match GAS: public site request = source Сайт AND not an authenticated admin.
  let actorName = "system";
  let actorRole = "";
  let isAuthorizedAdmin = false;
  if (token) {
    try {
      const user = await requireSession(token);
      isAuthorizedAdmin = true;
      actorName = user.name || user.email;
      actorRole = user.role;
    } catch {
      isAuthorizedAdmin = false;
    }
  }
  // Explicit flag from admin client (parity with GAS isAuthorizedAdminRequest).
  if (payload.isAuthorizedAdminRequest === true || payload.adminOverrideRestrictions === true) {
    if (!isAuthorizedAdmin) {
      try {
        const user = await requireSession(token);
        isAuthorizedAdmin = true;
        actorName = user.name || user.email;
        actorRole = user.role;
      } catch {
        return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
      }
    }
  }

  const isPublicSite = source === "Сайт" && !isAuthorizedAdmin;

  if (!isPublicSite && !isAuthorizedAdmin) {
    return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
  }

  const checkIn = String(payload.checkIn || "").slice(0, 10);
  const checkOut = String(payload.checkOut || "").slice(0, 10);
  if (!checkIn || !checkOut || !payload.name) {
    return fail("checkIn, checkOut, name required");
  }

  const roomId = await resolveRoomId(payload);
  const existingId = payload.id ? String(payload.id) : "";
  const isUpdate = Boolean(existingId || payload.row);

  // Публіка може лише створювати; апдейти — лише адмінка / webhook.
  if (isUpdate && isPublicSite) {
    return fail("Оновлення броні з сайту заборонено", 403, "UNAUTHORIZED");
  }

  const skipOverlap =
    isAuthorizedAdmin && payload.adminOverrideRestrictions === true;
  if (roomId && !skipOverlap) {
    const cottage = String(payload.cottage || "");
    const conflicting = await findOverlappingBookings({
      roomId,
      checkIn,
      checkOut,
      excludeId: existingId || undefined,
      cottage: cottage || undefined,
    });
    if (conflicting.length) {
      return ok({ success: false, error: "OVERLAP", message: "Дати зайняті" });
    }
  }

  let id = existingId;
  if (!id) {
    id = isPublicSite ? `B-${Date.now()}` : `A-${Date.now()}`;
  } else if (payload.importId) {
    const exists = await getBookingById(id);
    if (exists) {
      return ok({ success: true, skipped: true, reason: "already_exists", orderId: id });
    }
  }

  let status = String(
    payload.status || (isPublicSite ? "Очікує підтвердження" : "Підтверджено")
  );
  if (isPublicSite) {
    const allowed = new Set(["Нова бронь", "Очікує підтвердження", "Очікує оплату"]);
    if (!allowed.has(status)) status = "Очікує підтвердження";
    // Defense: never accept «Очікує оплату» when online payment is off.
    if (status === "Очікує оплату") {
      const { loadAllSettings } = await import("@/lib/db/settings");
      const {
        hasPaymentSettingsRecord,
        resolveOnlinePaymentEnabled,
      } = await import("@/lib/payment/paymentSettings");
      const all = await loadAllSettings();
      const enabled = resolveOnlinePaymentEnabled(all.paymentSettings, {
        hasRecord: hasPaymentSettingsRecord(all.paymentSettings),
      });
      if (!enabled) {
        status = "Очікує підтвердження";
      }
    }
  }

  // Preserve existing meta/fees on update when payload omits them
  const prev = isUpdate ? await getBookingById(id) : null;

  let booking: ApiBooking = {
    ...(prev || {}),
    ...payload,
    id,
    roomId: roomId || payload.roomId || prev?.roomId,
    checkIn,
    checkOut,
    status,
    source: source || String(prev?.source || "Адмінка"),
    name: String(payload.name || prev?.name || ""),
    phone: String(payload.phone ?? prev?.phone ?? ""),
    totalPrice: Number(payload.totalPrice ?? prev?.totalPrice) || 0,
    paidAmount: isPublicSite
      ? 0
      : Number(payload.paidAmount ?? prev?.paidAmount) || 0,
    createdAt:
      (prev?.createdAt as string) ||
      payload.createdAt ||
      new Date().toISOString().slice(0, 10),
    assignmentState:
      payload.assignmentState === "holding"
        ? "holding"
        : payload.assignmentState || prev?.assignmentState || "assigned",
  };

  // Public site: never trust client money fields — recompute from settings.
  if (isPublicSite) {
    const { repricePublicBooking, applyPublicReprice } = await import(
      "@/lib/public-booking/repricePublicBooking"
    );
    const priced = await repricePublicBooking(payload);
    if (!priced.ok) {
      if (priced.error === "OVERLAP") {
        return ok({ success: false, error: "OVERLAP", message: priced.message });
      }
      if (priced.error === "MIN_STAY") {
        return ok({
          success: false,
          error: "MIN_STAY",
          message: priced.message,
          requiredMin: priced.requiredMin,
        });
      }
      return fail(priced.message || "PRICE_FAILED", 400, priced.error);
    }
    booking = applyPublicReprice(booking, priced);
  }

  if (isPublicSite && status === "Очікує оплату" && !booking.paymentExpiresAt) {
    booking.paymentExpiresAt = addHoursIso(await paymentWindowHoursFromSettings());
  }

  const saved = await upsertBooking(booking);
  if (isAuthorizedAdmin) {
    const changes = isUpdate
      ? buildBookingUpdateChanges(prev, booking)
      : buildBookingCreateChanges(booking);
    const entries = buildHistoryEntries({
      type: isUpdate ? "booking.update" : "booking.create",
      changes,
      actorName,
      summary: changes.length
        ? undefined
        : `${checkIn} → ${checkOut}`,
    });
    if (entries.length) {
      await appendChangeHistory(id, entries);
    }
    if (isUpdate) {
      void import("@/lib/telegram/changeLogNotify")
        .then(({ notifyBookingChangeLog }) =>
          notifyBookingChangeLog({
            booking: saved,
            changes,
            actorName,
            actorRole,
          })
        )
        .catch((err) => console.warn("[TG change log] booking update failed", err));
    }
  }

  const isAdminManualCreate =
    isAuthorizedAdmin &&
    !isUpdate &&
    !isPublicSite &&
    !payload.importId &&
    booking.assignmentState !== "holding";

  if (isAdminManualCreate) {
    try {
      const { adminBookingNeedsPaymentLink, sendAdminCreatedBookingSms } =
        await import("@/lib/sms/adminCreatedBookingSms");
      const { loadSmsSettingsSystem } = await import("@/lib/sms/loadSmsSettings");
      const smsSettings = await loadSmsSettingsSystem();

      let smsBooking = saved;
      if (adminBookingNeedsPaymentLink(saved)) {
        const patch: Record<string, unknown> = {};
        if (!saved.paymentExpiresAt) {
          patch.paymentExpiresAt = addHoursIso(await paymentWindowHoursFromSettings());
        }
        const status = String(saved.status || "");
        if (!/очікує оплату/i.test(status)) {
          patch.status = "Очікує оплату";
        }
        // Do NOT write expected prepay into prepayAmount — that field is money
        // received. /pay resolves the site policy when the field is 0.
        if (Object.keys(patch).length) {
          smsBooking = await upsertBooking({ ...saved, ...patch });
        }
      }

      void sendAdminCreatedBookingSms(smsBooking, smsSettings);
    } catch (err) {
      console.warn("[createBooking] admin confirm SMS failed", err);
    }
  }

  return ok({
    success: true,
    orderId: saved.id,
    prepayment: Number(saved.prepayAmount) || undefined,
  });
}

async function handleConfirmPayment(payload: Record<string, unknown>): Promise<DispatchResult> {
  if (!checkWebhookSecret(payload.webhookSecret)) {
    return fail("Invalid webhook secret", 401, "UNAUTHORIZED");
  }
  const orderRef = String(payload.orderReference || payload.orderId || "");
  const booking = await getBookingById(orderRef);
  if (!booking) return ok({ ok: false, reason: "not_found" });

  const status = String(booking.status || "");
  if (/підтвердж/i.test(status) && Number(booking.paidAmount) > 0) {
    return ok({
      ok: true,
      updated: false,
      bookingId: booking.id,
      displayId: booking.id,
    });
  }

  const amountPaid = Number(payload.amountPaid) || 0;
  const total = Number(booking.totalPrice) || 0;
  const prepay = Number(booking.prepayAmount) || 0;
  const target = prepay > 0 ? prepay : total;
  // amount may be in kopiyky
  const paidUah = amountPaid >= target * 50 ? amountPaid / 100 : amountPaid;

  const payments = Array.isArray(booking.payments) ? [...(booking.payments as unknown[])] : [];
  const paidAt = new Date().toISOString();
  const provider = String(payload.paymentProvider || "mono");
  payments.push({
    at: paidAt,
    date: paidAt.slice(0, 10),
    amount: paidUah,
    method: provider.toLowerCase().includes("mono") ? "ФОП" : "Картка",
    type: "online",
    provider,
    transactionId: payload.transactionId || "",
    testMode: Boolean(payload.paymentTestMode),
  });

  const next = await upsertBooking({
    ...booking,
    status: "Підтверджено",
    paidAmount: Math.max(Number(booking.paidAmount) || 0, paidUah),
    prepayAmount: prepay || paidUah,
    payments,
  });

  return ok({
    ok: true,
    updated: true,
    bookingId: next.id,
    displayId: next.id,
  });
}

/**
 * Supabase-backed implementation of GAS actions (same JSON contracts).
 */
export async function dispatchSupabaseAction(ctx: DispatchContext): Promise<DispatchResult> {
  const action = actionName(ctx);
  const token = extractToken(ctx);
  const body = ctx.body || {};

  try {
    switch (action) {
      case "register":
        return fail("Реєстрація недоступна — запросіть доступ у власника", 501, "NOT_IMPLEMENTED");
      case "login": {
        const result = await loginWithPassword(
          String(body.email || ""),
          String(body.password || "")
        );
        return ok({ success: true, ...result });
      }
      case "logout": {
        await logoutToken(token || "");
        return ok({ success: true });
      }
      case "getSession": {
        const v = await verifyToken(token || "");
        if (!v.valid) return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        return ok({
          user: { id: v.userId, email: v.email, name: v.name },
          accessToken: token,
        });
      }
      case "verifyToken": {
        const v = await verifyToken(token || "");
        return ok(v.valid ? { ...v } : { valid: false });
      }
      case "adminBoot": {
        const boot = await adminBoot(token || "");
        return ok(boot);
      }
      case "getMembership": {
        const boot = await adminBoot(token || "");
        return ok({ membership: boot.membership });
      }
      case "initData": {
        const rawSettings = await getSettingsPayload({
          omitSms: true,
          omitTransactions: true,
          omitTeam: true,
        });
        const { pickPublicSettings } = await import(
          "@/lib/public-booking/publicInitData"
        );
        const settings = pickPublicSettings(rawSettings);
        const bookings = await listBookingsPublic();
        return ok({ settings, bookings });
      }
      case "adminInitData": {
        await requireSession(token);
        const settings = await getSettingsPayload({
          omitTeam: true,
          stripSmsJournal: true,
        });
        const bookings = await listBookings();
        return ok({ settings, bookings });
      }
      case "settings": {
        await requireSession(token);
        const settings = await getSettingsPayload({ omitTeam: true });
        return ok(settings);
      }
      case "saveSettings": {
        const user = await requireSession(token);
        if (user.role !== "owner") return fail("FORBIDDEN", 403, "FORBIDDEN");
        const settings = (body.settings || {}) as Record<string, unknown>;
        const saveKeys = Array.isArray(body.saveKeys)
          ? (body.saveKeys as string[])
          : undefined;
        await saveSettingsMerge(settings, saveKeys);
        return ok({ success: true });
      }
      case "getAllBookings": {
        await requireSession(token);
        return ok({ bookings: await listBookings() });
      }
      case "getBookingByDisplayId": {
        const orderId = String(body.orderId || ctx.query.orderId || "");
        if (!checkWebhookSecret(body.webhookSecret) && !(await verifyToken(token || "")).valid) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const booking = await getBookingById(orderId);
        if (!booking) return ok({ ok: false, reason: "not_found" });
        return ok({ ok: true, booking });
      }
      case "checkStatus": {
        const orderId = String(ctx.query.orderId || body.orderId || "");
        const booking = await getBookingById(orderId);
        if (!booking) return ok({ ok: false, found: false });
        return ok({
          ok: true,
          found: true,
          status: booking.status,
          paidAmount: booking.paidAmount,
          totalPrice: booking.totalPrice,
        });
      }
      case "createBooking":
        return handleCreateBooking(body, token);
      case "deleteBooking": {
        const deleter = await requireSession(token);
        let id = String(body.id || "");
        if (!id && body.row != null && body.row !== "") {
          const all = await listBookings();
          const match = all.find((b) => Number(b.row) === Number(body.row));
          id = match ? String(match.id) : "";
        }
        if (!id) return fail("id required");
        const existing = await getBookingById(id);
        await deleteBookingById(id);
        if (existing) {
          void import("@/lib/telegram/changeLogNotify")
            .then(({ notifyBookingDeletedLog }) =>
              notifyBookingDeletedLog({
                booking: existing,
                actorName: deleter.name || deleter.email,
                actorRole: deleter.role,
              })
            )
            .catch((err) => console.warn("[TG change log] delete failed", err));
        }
        try {
          const { syncPendingReviewReminders } = await import(
            "@/lib/telegram/pendingReviewReminder"
          );
          await syncPendingReviewReminders();
        } catch (err) {
          console.warn("[deleteBooking] pending review reminder sync failed", err);
        }
        return ok({ success: true });
      }
      case "reviewBooking": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          await requireSession(token);
        }
        const orderId = String(body.orderId || "");
        const decision = String(body.decision || "");
        const booking = await getBookingById(orderId);
        if (!booking) return ok({ ok: false, reason: "not_found" });
        if (decision === "approve") {
          const { confirmPendingReviewTokensInComment } = await import(
            "@/lib/sms/reviewRequestSmsVars"
          );
          const comment = confirmPendingReviewTokensInComment(
            String(booking.comment || "")
          );
          let approved: typeof booking = {
            ...booking,
            comment,
            status: "Очікує оплату",
            paymentExpiresAt:
              booking.paymentExpiresAt ||
              addHoursIso(await paymentWindowHoursFromSettings()),
          };
          try {
            const {
              repriceBookingForApprove,
              applyApprovedReviewReprice,
            } = await import("@/lib/public-booking/repricePublicBooking");
            const priced = await repriceBookingForApprove(approved);
            if (priced.ok) {
              approved = applyApprovedReviewReprice(approved, priced);
            } else {
              console.warn("[reviewBooking] reprice on approve failed", priced);
            }
          } catch (err) {
            console.warn("[reviewBooking] reprice on approve threw", err);
          }
          const next = await upsertBooking(approved);
          return ok({ ok: true, booking: next });
        }
        if (decision === "reject") {
          const next = await upsertBooking({ ...booking, status: "Скасовано" });
          void import("@/lib/telegram/changeLogNotify")
            .then(({ notifyBookingChangeLog }) =>
              notifyBookingChangeLog({
                booking: next,
                changes: [
                  {
                    label: "Статус",
                    from: String(booking.status || "—"),
                    to: "Скасовано",
                  },
                ],
                actorName: "система",
              })
            )
            .catch((err) => console.warn("[TG change log] review reject failed", err));
          return ok({ ok: true, booking: next });
        }
        return fail("decision must be approve|reject");
      }
      case "confirmBookingPayment":
        return handleConfirmPayment(body);
      case "storeMonoInvoice": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const orderId = String(body.orderId || "");
        const booking = await getBookingById(orderId);
        if (!booking) return ok({ ok: false, reason: "not_found" });
        if (!/очікує оплату/i.test(String(booking.status || ""))) {
          return ok({ ok: false, reason: "bad_status", booking });
        }
        const next = await patchBookingMeta(orderId, {
          monoInvoiceId: String(body.invoiceId || ""),
          monoPageUrl: String(body.pageUrl || ""),
          paymentExpiresAt:
            booking.paymentExpiresAt ||
            addHoursIso(await paymentWindowHoursFromSettings()),
        });
        return ok({ ok: true, stored: true, booking: next });
      }
      case "clearMonoPaymentAttempt": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const orderId = String(body.orderId || "");
        const next = await patchBookingMeta(orderId, {
          monoInvoiceId: "",
          monoPageUrl: "",
        });
        return ok({ ok: true, booking: next });
      }
      case "expireBookingPayment": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const orderId = String(body.orderId || "");
        const booking = await getBookingById(orderId);
        if (!booking) return ok({ ok: false, reason: "not_found" });
        const expires = String(booking.paymentExpiresAt || "");
        if (
          !/очікує оплату/i.test(String(booking.status || "")) ||
          !expires ||
          Date.parse(expires) > Date.now()
        ) {
          return ok({ ok: true, expired: false, booking });
        }
        const next = await upsertBooking({
          ...booking,
          status: "Скасовано",
          expiredAt: new Date().toISOString(),
        });
        void import("@/lib/telegram/changeLogNotify")
          .then(({ notifyBookingChangeLog }) =>
            notifyBookingChangeLog({
              booking: next,
              changes: [
                {
                  label: "Статус",
                  from: String(booking.status || "Очікує оплату"),
                  to: "Скасовано",
                },
              ],
              actorName: "система",
            })
          )
          .catch((err) => console.warn("[TG change log] expire failed", err));
        return ok({ ok: true, expired: true, booking: next });
      }
      case "listPaymentLifecycle": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const bookings = await listBookings();
        const now = Date.now();
        const due: ApiBooking[] = [];
        const pendingSms: ApiBooking[] = [];
        const pendingTelegram: ApiBooking[] = [];
        for (const booking of bookings) {
          if (String(booking.source || "") !== "Сайт") continue;
          const status = String(booking.status || "");
          const expiresRaw = String(booking.paymentExpiresAt || "").trim();
          const expiresAt = expiresRaw ? Date.parse(expiresRaw) : NaN;
          if (
            status === "Очікує оплату" &&
            Number.isFinite(expiresAt) &&
            expiresAt + 2 * 60 * 1000 <= now
          ) {
            due.push(booking);
          }
          // SMS queue must not require paymentExpiresAt (approve sets it, but
          // older/admin rows may still need payment_link / success / expiry SMS).
          if (
            (status === "Очікує оплату" && !booking.paymentLinkSmsSentAt) ||
            (status === "Підтверджено" &&
              Number(booking.paidAmount) > 0 &&
              !booking.successSmsSentAt) ||
            (status === "Скасовано" && booking.expiredAt && !booking.expirySmsSentAt)
          ) {
            pendingSms.push(booking);
          }
          if (
            status === "Підтверджено" &&
            Number(booking.paidAmount) > 0 &&
            !booking.paidTelegramSentAt
          ) {
            pendingTelegram.push(booking);
          }
        }
        return ok({ ok: true, due, pendingSms, pendingTelegram });
      }
      case "recordBookingRefund": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          await requireSession(token);
        }
        const orderId = String(body.orderId || body.orderReference || "");
        const booking = await getBookingById(orderId);
        if (!booking) return ok({ ok: false, reason: "not_found" });
        const amount = Number(body.amount) || 0;
        const paidFrom = Number(booking.paidAmount) || 0;
        const paid = Math.max(0, paidFrom - amount);
        const cancelBooking = body.cancelBooking === true;
        const next = await upsertBooking({
          ...booking,
          paidAmount: paid,
          ...(cancelBooking ? { status: "Скасовано" } : {}),
        });
        let actorName = String(body.actorName || "").trim() || "система";
        let actorRole = String(body.actorRole || "").trim();
        if (actorName === "система") {
          try {
            const user = await requireSession(token);
            actorName = user.name || user.email;
            actorRole = user.role;
          } catch {
            /* webhook / no session */
          }
        }
        void import("@/lib/telegram/changeLogNotify")
          .then(({ notifyBookingRefundLog }) =>
            notifyBookingRefundLog({
              booking: next,
              amount,
              paidFrom,
              paidTo: paid,
              cancelled: cancelBooking,
              actorName,
              actorRole,
            })
          )
          .catch((err) => console.warn("[TG change log] refund failed", err));
        return ok({ ok: true, booking: next });
      }
      case "markBookingSmsSent": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const orderId = String(body.orderId || "");
        const kind = String(
          body.smsType || body.kind || body.type || "payment_link"
        );
        const field =
          kind === "success"
            ? "successSmsSentAt"
            : kind === "expiry"
              ? "expirySmsSentAt"
              : "paymentLinkSmsSentAt";
        const existing = await getBookingById(orderId);
        if (existing && existing[field]) {
          return ok({ ok: true, claimed: false, already: true, booking: existing });
        }
        const next = await patchBookingMeta(orderId, {
          [field]: new Date().toISOString(),
        });
        return ok({ ok: true, claimed: true, booking: next });
      }
      case "clearBookingSmsSent": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const orderId = String(body.orderId || "");
        const kind = String(
          body.smsType || body.kind || body.type || "payment_link"
        );
        const field =
          kind === "success"
            ? "successSmsSentAt"
            : kind === "expiry"
              ? "expirySmsSentAt"
              : "paymentLinkSmsSentAt";
        const next = await patchBookingMeta(orderId, { [field]: "" });
        return ok({ ok: true, booking: next });
      }
      case "markPaidBookingTelegramSent": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const orderId = String(body.orderId || "");
        const existing = await getBookingById(orderId);
        if (existing?.paidTelegramSentAt) {
          return ok({ ok: true, claimed: false, booking: existing });
        }
        const next = await patchBookingMeta(orderId, {
          paidTelegramSentAt: new Date().toISOString(),
        });
        return ok({ ok: true, claimed: true, booking: next });
      }
      case "getGuestProfiles": {
        await requireSession(token);
        return ok({ profiles: await getGuestProfilesMap() });
      }
      case "saveGuestProfile": {
        await requireSession(token);
        const profile = await saveGuestProfile({
          phone: String(body.phone || ""),
          rating: body.rating as number | null | undefined,
          note: body.note as string | null | undefined,
        });
        return ok({ success: true, profile });
      }
      case "listBookingActivity": {
        await requireSession(token);
        const orderId = String(ctx.query.orderId || ctx.query.id || body.orderId || "");
        const sbBooking = await getBookingById(orderId);
        const { getDb } = await import("@/lib/db/mappers");
        const { data } = await getDb()
          .from("bookings")
          .select("change_history")
          .eq("id", orderId)
          .maybeSingle();
        const raw = Array.isArray(data?.change_history) ? data!.change_history : [];
        const items = raw
          .map((entry, i) => {
            const e = (entry && typeof entry === "object" ? entry : {}) as Record<
              string,
              unknown
            >;
            return {
              id: String(e.id || `h-${i}`),
              at: String(e.at || ""),
              type: String(e.type || "booking.update"),
              label: String(e.label || ""),
              from: String(e.from || ""),
              to: String(e.to || ""),
              actorName: String(e.actorName || ""),
              summary: String(e.summary || ""),
            };
          })
          .sort((a, b) => String(b.at).localeCompare(String(a.at)));
        return ok({
          orderId,
          items,
          total: items.length,
          bookingFound: Boolean(sbBooking),
        });
      }
      case "listTeamMembers": {
        const user = await requireSession(token);
        if (user.role !== "owner") return fail("FORBIDDEN", 403, "FORBIDDEN");
        return ok(await listTeamMembersPublic());
      }
      case "createTeamMember": {
        const user = await requireSession(token);
        const result = await createTeamMember({
          email: String(body.email || ""),
          name: String(body.name || ""),
          role: String(body.role || "admin"),
          mode: body.mode === "invite" ? "invite" : "password",
          password: body.password ? String(body.password) : undefined,
          inviteBaseUrl: body.inviteBaseUrl ? String(body.inviteBaseUrl) : undefined,
          actorRole: user.role,
        });
        return ok(result);
      }
      case "updateTeamMember": {
        const user = await requireSession(token);
        const result = await updateTeamMember({
          id: String(body.id || ""),
          name: body.name != null ? String(body.name) : undefined,
          role: body.role != null ? String(body.role) : undefined,
          active: body.active as boolean | undefined,
          password: body.password ? String(body.password) : undefined,
          actorRole: user.role,
          actorId: user.id,
        });
        return ok(result);
      }
      case "getInviteInfo": {
        const inviteToken = String(
          body.token || body.inviteToken || ctx.query.token || ""
        );
        return ok(await getInviteInfo(inviteToken));
      }
      case "acceptTeamInvite": {
        const result = await acceptTeamInvite({
          inviteToken: String(body.token || body.inviteToken || ""),
          password: String(body.password || ""),
          name: body.name ? String(body.name) : undefined,
        });
        return ok(result);
      }
      case "cronTelegramDigest": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        return ok({
          bookings: await listBookings(),
          settings: await getSettingsPayload({ omitTeam: true }),
        });
      }
      case "checkAvailability": {
        const checkIn = String(ctx.query.checkIn || body.checkIn || "").slice(0, 10);
        const checkOut = String(ctx.query.checkOut || body.checkOut || "").slice(0, 10);
        const roomId = String(ctx.query.roomId || body.roomId || "");
        if (!checkIn || !checkOut) return fail("checkIn/checkOut required");
        const settings = await loadAllSettings();
        const closed = Array.isArray(settings.closedDates) ? settings.closedDates : [];
        // simple closed-dates check
        for (const d of closed) {
          const day = String(d).slice(0, 10);
          if (day >= checkIn && day < checkOut) {
            return ok({
              available: false,
              error: "CLOSED_DATES",
              checkIn,
              checkOut,
              nights: nightsBetween(checkIn, checkOut),
            });
          }
        }
        if (roomId) {
          const overlaps = await findOverlappingBookings({ roomId, checkIn, checkOut });
          if (overlaps.length) {
            return ok({
              available: false,
              error: "OVERLAP",
              checkIn,
              checkOut,
              nights: nightsBetween(checkIn, checkOut),
            });
          }
        }
        return ok({
          available: true,
          checkIn,
          checkOut,
          nights: nightsBetween(checkIn, checkOut),
        });
      }
      case "syncIcalRoomBlocks": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const roomId = String(body.roomId || "");
        const cottage = String(body.cottage || "");
        const events = Array.isArray(body.events) ? body.events : [];
        let created = 0;
        let updated = 0;
        let cancelled = 0;
        const keepIds = new Set<string>();
        for (const ev of events as Array<Record<string, unknown>>) {
          const uid = String(ev.uid || "");
          if (!uid) continue;
          const id = `ICAL-${uid.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
          keepIds.add(id);
          const existing = await getBookingById(id);
          const row: ApiBooking = {
            id,
            roomId,
            cottage: cottage || existing?.cottage || "",
            checkIn: String(ev.checkIn || "").slice(0, 10),
            checkOut: String(ev.checkOut || "").slice(0, 10),
            status: "Підтверджено",
            name: String(ev.summary || "Booking.com"),
            phone: "",
            source: "Booking",
            comment: `icalUid:${uid}`,
            totalPrice: 0,
            paidAmount: 0,
            guests: 2,
            pets: "Ні",
            createdAt: existing?.createdAt || new Date().toISOString().slice(0, 10),
          };
          await upsertBooking(row);
          if (existing) updated += 1;
          else created += 1;
        }
        const all = await listBookings();
        for (const b of all) {
          if (String(b.source) !== "Booking") continue;
          if (String(b.roomId || "") !== roomId) continue;
          if (!keepIds.has(String(b.id))) {
            await upsertBooking({ ...b, status: "Скасовано" });
            cancelled += 1;
          }
        }
        return ok({
          success: true,
          roomId,
          created,
          updated,
          cancelled,
          skipped: 0,
          lastSyncedAt: new Date().toISOString(),
        });
      }
      case "patchIcalRoomMeta": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
        }
        const settings = await loadAllSettings();
        const ical = {
          ...((settings.icalSyncSettings as object) || {}),
          ...(body.meta as object),
          updatedAt: new Date().toISOString(),
        };
        await saveSettingsMerge({ icalSyncSettings: ical }, ["icalSyncSettings"]);
        return ok({ success: true });
      }
      case "uploadFile": {
        await requireSession(token);
        try {
          const { uploadMediaBase64 } = await import("@/lib/db/storage");
          const result = await uploadMediaBase64({
            path: String(body.path || ""),
            base64: String(body.base64 || ""),
            contentType: String(body.contentType || "image/webp"),
            upsert: body.upsert === true,
          });
          return ok({ success: true, publicUrl: result.publicUrl });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return fail(message, 400, "UPLOAD_FAILED");
        }
      }
      case "fetchPublicTenant": {
        const settings = await getSettingsPayload({
          omitSms: true,
          omitTransactions: true,
          omitTeam: true,
        });
        const branding =
          settings.branding &&
          typeof settings.branding === "object" &&
          !Array.isArray(settings.branding)
            ? (settings.branding as Record<string, unknown>)
            : {};
        const rooms = Array.isArray(settings.roomsList) ? settings.roomsList : [];
        const discounts = Array.isArray(settings.discountsList)
          ? settings.discountsList
          : Array.isArray(settings.discounts)
            ? settings.discounts
            : [];
        const customPrices =
          settings.customPrices &&
          typeof settings.customPrices === "object" &&
          !Array.isArray(settings.customPrices)
            ? settings.customPrices
            : {};
        return ok({
          tenantId: "default",
          tenantName:
            String(branding.site_title || "").trim() || "АЖ У НЕБІ",
          subdomain: "default",
          branding,
          rooms,
          discounts,
          customPrices,
        });
      }
      case "fetchTenants": {
        const settings = await getSettingsPayload({
          omitSms: true,
          omitTransactions: true,
          omitTeam: true,
        });
        return ok({
          tenant_id: "default",
          settings,
          rooms: settings.roomsList || [],
        });
      }
      case "getSmsSettings": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          await requireSession(token);
        }
        const settings = await loadAllSettings();
        const { normalizeSmsSettings } = await import("@/lib/sms/smsSettings");
        return ok({ smsSettings: normalizeSmsSettings(settings.smsSettings) });
      }
      case "appendSmsJournal": {
        if (!checkWebhookSecret(body.webhookSecret)) {
          await requireSession(token);
        }
        const settings = await loadAllSettings();
        const { normalizeSmsSettings } = await import("@/lib/sms/smsSettings");
        const sms = normalizeSmsSettings(settings.smsSettings) as unknown as Record<
          string,
          unknown
        >;
        const journal = Array.isArray(sms.journal) ? [...(sms.journal as unknown[])] : [];
        journal.unshift({
          at: new Date().toISOString(),
          ...(body.entry as object),
        });
        sms.journal = journal.slice(0, 100);
        await saveSettingsMerge({ smsSettings: sms }, ["smsSettings"]);
        return ok({ success: true });
      }
      case "syncBookingsAfterRoomRename": {
        await requireSession(token);
        const from = String(body.from || body.oldName || "");
        const to = String(body.to || body.newName || "");
        if (!from || !to) return fail("from/to required");
        const bookings = await listBookings();
        let n = 0;
        for (const b of bookings) {
          if (String(b.cottage || "") === from) {
            await upsertBooking({ ...b, cottage: to });
            n += 1;
          }
        }
        return ok({ success: true, updated: n });
      }
      default:
        return fail(`Unsupported action on Supabase: ${action || "(none)"}`, 400, "UNKNOWN_ACTION");
    }
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (code === "UNAUTHORIZED" || message === "UNAUTHORIZED") {
      return fail("UNAUTHORIZED", 401, "UNAUTHORIZED");
    }
    if (code === "FORBIDDEN") return fail("FORBIDDEN", 403, "FORBIDDEN");
    if (code === "INVALID_CREDENTIALS") {
      return fail(message, 401, "INVALID_CREDENTIALS");
    }
    console.error("[dispatchSupabaseAction]", action, err);
    return fail(message, 500, "INTERNAL");
  }
}
