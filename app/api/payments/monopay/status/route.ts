import { NextResponse } from "next/server";
import { parseChildrenFromComment } from "@/components/admin/desktop/settings/additionalServicesLogic";
import { fetchBookingByDisplayId } from "@/lib/gas-api";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";

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

  const result = await fetchBookingByDisplayId(orderId);
  if (!result.ok || !result.booking) {
    return NextResponse.json(
      { ok: false, error: "BOOKING_NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const status = String(result.booking.status || "");
  const paidAmount = Number(result.booking.paidAmount) || 0;
  const comment = String(result.booking.comment || "");
  const childCount = parseChildrenFromComment(comment);
  return NextResponse.json(
    {
      ok: true,
      paid: status === "Підтверджено",
      awaiting: isAwaitingPaymentStatus(status),
      booking: {
        orderId,
        cottage: result.booking.cottage,
        checkIn: result.booking.checkIn,
        checkOut: result.booking.checkOut,
        guests: Number(result.booking.guests) || 0,
        childCount,
        comment,
        nights: countNights(result.booking.checkIn, result.booking.checkOut),
        totalPrice: result.booking.totalPrice,
        prepayment: paidAmount,
        paidAmount,
        flow: "instant" as const,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
