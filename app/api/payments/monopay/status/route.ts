import { NextResponse } from "next/server";
import { parseChildrenFromComment } from "@/components/admin/desktop/settings/additionalServicesLogic";
import type { RoomLike } from "@/lib/admin/roomBookingMatch";
import { getBookingById } from "@/lib/db/bookings";
import { listRooms } from "@/lib/db/rooms";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";
import { publicCottageLabel } from "@/lib/public-booking/publicCottageLabel";

export const runtime = "nodejs";

function countNights(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn.includes("T") ? checkIn : `${checkIn}T12:00:00`);
  const b = new Date(checkOut.includes("T") ? checkOut : `${checkOut}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim() || "";
  if (!orderId || orderId.length > 120) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ORDER" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const booking = await getBookingById(orderId);
  if (!booking) {
    return NextResponse.json(
      { ok: false, error: "BOOKING_NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const status = String(booking.status || "");
  const paidAmount = Number(booking.paidAmount) || 0;
  const comment = String(booking.comment || "");
  const childCount = parseChildrenFromComment(comment);
  const roomIdRaw = booking.roomId;
  const roomId =
    roomIdRaw == null || roomIdRaw === ""
      ? null
      : typeof roomIdRaw === "string" || typeof roomIdRaw === "number"
        ? roomIdRaw
        : String(roomIdRaw);
  const checkIn = String(booking.checkIn || "");
  const checkOut = String(booking.checkOut || "");

  // Guest receipt must show site listing name («Будиночок 1-12»), not chessboard («Будиночок 8»).
  let rooms: RoomLike[] = [];
  try {
    rooms = (await listRooms()) as RoomLike[];
  } catch (err) {
    console.warn("[monopay/status] listRooms failed", err);
  }
  const cottage = publicCottageLabel(
    { cottage: String(booking.cottage || ""), roomId },
    rooms,
    String(booking.cottage || "")
  );

  return NextResponse.json(
    {
      ok: true,
      paid: status === "Підтверджено",
      awaiting: isAwaitingPaymentStatus(status),
      booking: {
        orderId,
        cottage,
        roomId,
        checkIn,
        checkOut,
        guests: Number(booking.guests) || 0,
        childCount,
        comment,
        nights: countNights(checkIn, checkOut),
        totalPrice: booking.totalPrice,
        prepayment: paidAmount,
        paidAmount,
        flow: "instant" as const,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
