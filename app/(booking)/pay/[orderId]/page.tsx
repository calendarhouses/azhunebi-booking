import { notFound, redirect } from "next/navigation";
import { PayBookingPage } from "@/components/public/PayBookingPage";
import { fetchBookingByDisplayId, fetchPublicTenantData } from "@/lib/gas-api";
import { toImageDisplaySrc } from "@/lib/driveImageUrl";
import {
  getMonoChastTestAmountUah,
  getMonoTestAmountUah,
} from "@/lib/monopay/config";
import { isMonoPartsConfigured } from "@/lib/monoparts/config";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";

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

  const [result, tenant] = await Promise.all([
    fetchBookingByDisplayId(id),
    fetchPublicTenantData("default"),
  ]);
  if (!result.ok || !result.booking) notFound();

  const booking = result.booking;
  if (booking.status === "Підтверджено") {
    redirect(`/?payment=return&orderId=${encodeURIComponent(id)}`);
  }
  if (!isAwaitingPaymentStatus(booking.status)) notFound();

  const prepayAmount = Math.round(Number(booking.prepayAmount) || 0);
  const totalPrice = Math.round(Number(booking.totalPrice) || 0);
  if (prepayAmount <= 0 && totalPrice <= 0) notFound();

  const debitTestAmountUah = getMonoTestAmountUah();
  const partsTestAmountUah = getMonoChastTestAmountUah();
  const branding = tenant?.branding || {};
  const brandName =
    String(branding.site_title || "").trim() ||
    String(tenant?.tenantName || "").trim() ||
    "АЖ У НЕБІ";
  const brandLogoUrl =
    toImageDisplaySrc(String(branding.logo_url || "").trim(), 512) || null;

  return (
    <PayBookingPage
      orderId={id}
      cottage={booking.cottage || "Котедж"}
      checkInLabel={formatDateUk(booking.checkIn)}
      checkOutLabel={formatDateUk(booking.checkOut)}
      prepayAmount={prepayAmount > 0 ? prepayAmount : totalPrice}
      totalPrice={totalPrice}
      partsEnabled={
        isMonoPartsConfigured() &&
        (partsTestAmountUah != null ||
          Math.round(Number(booking.prepayAmount) || 0) >= 2 ||
          Math.round(Number(booking.totalPrice) || 0) >= 2)
      }
      brandName={brandName}
      brandLogoUrl={brandLogoUrl}
      debitTestAmountUah={debitTestAmountUah}
      partsTestAmountUah={partsTestAmountUah}
    />
  );
}
