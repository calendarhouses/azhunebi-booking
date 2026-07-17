import { notFound, redirect } from "next/navigation";
import { PayBookingPage } from "@/components/public/PayBookingPage";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";
import { fetchBookingByDisplayId } from "@/lib/gas-api";

export const dynamic = "force-dynamic";

const UK_MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня",
];

function formatDateUk(value?: string): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate()} ${UK_MONTHS[d.getMonth()]}`;
}

type PageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ payment?: string }>;
};

export default async function PayOrderPage({ params, searchParams }: PageProps) {
  const { orderId } = await params;
  const { payment } = await searchParams;
  const id = decodeURIComponent(orderId).trim();
  if (!id) notFound();

  if (payment === "return") {
    redirect(`/?payment=return&orderId=${encodeURIComponent(id)}`);
  }

  const result = await fetchBookingByDisplayId(id);
  if (!result.ok || !result.booking) notFound();

  const booking = result.booking;
  if (booking.status === "Підтверджено") {
    redirect(`/?payment=return&orderId=${encodeURIComponent(id)}`);
  }
  if (!isAwaitingPaymentStatus(booking.status)) notFound();

  const prepayAmount = Math.round(Number(booking.prepayAmount) || 0);
  if (prepayAmount <= 0) notFound();

  return (
    <PayBookingPage
      orderId={id}
      cottage={booking.cottage || "Котедж"}
      checkInLabel={formatDateUk(booking.checkIn)}
      checkOutLabel={formatDateUk(booking.checkOut)}
      prepayAmount={prepayAmount}
    />
  );
}
