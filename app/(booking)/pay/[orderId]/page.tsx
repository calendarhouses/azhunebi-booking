import { notFound } from "next/navigation";
import { PayBookingPage } from "@/components/public/PayBookingPage";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";
import { fetchBookingByDisplayId } from "@/lib/gas-api";
import { createWayForPayPaymentData } from "@/lib/wayforpay/createPaymentData";

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
  searchParams: Promise<{ paid?: string }>;
};

export default async function PayOrderPage({ params, searchParams }: PageProps) {
  const { orderId } = await params;
  const { paid } = await searchParams;
  const id = decodeURIComponent(orderId).trim();
  if (!id) notFound();

  if (paid === "1") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1>Дякуємо!</h1>
          <p>Якщо оплата пройшла успішно, статус броні оновиться автоматично.</p>
          <p style={{ color: "#6b7280" }}>№ {id}</p>
        </div>
      </main>
    );
  }

  const result = await fetchBookingByDisplayId(id);
  if (!result.ok || !result.booking) notFound();

  const booking = result.booking;
  if (!isAwaitingPaymentStatus(booking.status)) notFound();

  const prepayAmount = Math.round(Number(booking.prepayAmount) || 0);
  const paymentData = createWayForPayPaymentData({
    orderReference: id,
    amount: prepayAmount,
    productName: `Передплата за ${booking.cottage || "бронювання"}`,
  });
  if (!paymentData) notFound();

  return (
    <PayBookingPage
      orderId={id}
      cottage={booking.cottage || "Котедж"}
      checkInLabel={formatDateUk(booking.checkIn)}
      checkOutLabel={formatDateUk(booking.checkOut)}
      prepayAmount={prepayAmount}
      guestName={booking.name || "Гість"}
      guestPhone={booking.phone || ""}
      paymentData={paymentData}
    />
  );
}
