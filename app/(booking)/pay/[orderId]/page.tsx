import { notFound, redirect } from "next/navigation";
import { PayBookingPage } from "@/components/public/PayBookingPage";
import { fetchBookingByDisplayId, fetchPublicTenantData } from "@/lib/gas-api-server";
import { toImageDisplaySrc } from "@/lib/driveImageUrl";
import {
  getMonoChastTestAmountUah,
  getMonoTestAmountUah,
} from "@/lib/monopay/config";
import { isMonoPartsConfigured } from "@/lib/monoparts/config";
import { isOnlinePaymentEnabledServer } from "@/lib/payment/loadPaymentSettings";
import { isMonoPartsEnabledFromSettings } from "@/lib/payment/paymentSettings";
import { loadAllSettings } from "@/lib/db/settings";
import { isAwaitingPaymentStatus } from "@/lib/public-booking/bookingReview";
import { publicCottageLabel } from "@/lib/public-booking/publicCottageLabel";

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

  if (!(await isOnlinePaymentEnabledServer())) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "2rem 1.25rem",
          background: "#f7f4ef",
          color: "#1c1c1c",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.35rem", margin: "0 0 0.75rem" }}>
            Онлайн-оплата тимчасово недоступна
          </h1>
          <p style={{ margin: 0, lineHeight: 1.5, opacity: 0.85 }}>
            Вашу заявку обробить адміністратор. Очікуйте підтвердження — ми
            звʼяжемося з вами.
          </p>
          <p style={{ margin: "1rem 0 0", fontSize: "0.9rem", opacity: 0.6 }}>
            Заявка: {id}
          </p>
          <a
            href="/"
            style={{
              display: "inline-block",
              marginTop: "1.5rem",
              color: "#4d6826",
              fontWeight: 600,
            }}
          >
            На головну
          </a>
        </div>
      </main>
    );
  }

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
  const allSettings = await loadAllSettings();
  const partsAllowed =
    isMonoPartsConfigured() && isMonoPartsEnabledFromSettings(allSettings);
  const settingsBranding =
    allSettings.branding &&
    typeof allSettings.branding === "object" &&
    !Array.isArray(allSettings.branding)
      ? (allSettings.branding as Record<string, unknown>)
      : {};
  const tenantBranding =
    tenant?.branding && typeof tenant.branding === "object"
      ? (tenant.branding as Record<string, unknown>)
      : {};
  const branding = { ...tenantBranding, ...settingsBranding };
  const brandName =
    String(branding.site_title || "").trim() ||
    String(tenant?.tenantName || "").trim() ||
    "АЖ У НЕБІ";
  const brandLogoUrl =
    toImageDisplaySrc(String(branding.logo_url || "").trim(), 512) || null;

  return (
    <PayBookingPage
      orderId={id}
      cottage={publicCottageLabel(booking, tenant?.rooms)}
      checkInLabel={formatDateUk(booking.checkIn)}
      checkOutLabel={formatDateUk(booking.checkOut)}
      prepayAmount={prepayAmount > 0 ? prepayAmount : totalPrice}
      totalPrice={totalPrice}
      partsEnabled={
        partsAllowed &&
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
