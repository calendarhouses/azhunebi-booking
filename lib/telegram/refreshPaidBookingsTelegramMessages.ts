import { type GasBookingRecord } from "@/lib/gas-api";

import { buildPaidBookingTelegramText } from "./paidBookingNotify";
import { type TelegramBookingMessageRef } from "./bookingsState";
import { editTelegramMessage } from "./sendMessage";
import { isTelegramConfigured } from "./config";

type TelegramBookingsState = Record<string, TelegramBookingMessageRef>;

function safeParseBookingsState(raw: unknown): TelegramBookingsState {
  if (!raw || typeof raw !== "object") return {};
  return raw as TelegramBookingsState;
}

export async function refreshPaidBookingsTelegramMessages(args: {
  bookings: GasBookingRecord[];
  settings: Record<string, unknown>;
}): Promise<{ edited: number; missingBookings: number }> {
  if (!isTelegramConfigured()) {
    return { edited: 0, missingBookings: 0 };
  }

  const { bookings, settings } = args;
  const storedState = safeParseBookingsState((settings as any).telegramBookingsState);

  const bookingById = new Map<string, GasBookingRecord>();
  for (const b of bookings) {
    const id = String(b.id || "").trim();
    if (id) bookingById.set(id, b);
  }

  let edited = 0;
  let missingBookings = 0;

  for (const [bookingId, ref] of Object.entries(storedState)) {
    if (!ref?.messageId || ref.chatId == null) continue;
    const booking = bookingById.get(bookingId);

    if (!booking) {
      missingBookings += 1;
      const caption = `🛎 <b>Бронювання не знайдено/скасовано</b>\n\n🔖 ${bookingId}`;
      await editTelegramMessage(ref.chatId, ref.messageId, caption).catch(
        () => undefined
      );
      edited += 1;
      continue;
    }

    const caption = buildPaidBookingTelegramText(booking);
    await editTelegramMessage(ref.chatId, ref.messageId, caption).catch(
      () => undefined
    );
    edited += 1;
  }

  return { edited, missingBookings };
}

