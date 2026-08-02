import { headers } from "next/headers";
import { PublicBookPage } from "@/components/public/PublicBookPage";
import type { PublicTenantPayload } from "@/lib/public-booking/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenant_id: string }>;
};

/**
 * Paint shell immediately. Do NOT await GAS on SSR — under Apps Script
 * queue pressure fetchPublicTenantData returns null and notFound() becomes
 * an intermittent 404 ("This page couldn't load" on mobile).
 * Client PublicBookingProvider loads initData with retries.
 */
export default async function BookTenantPage({ params }: PageProps) {
  const { tenant_id } = await params;
  const data: PublicTenantPayload = {
    tenantId: tenant_id || "default",
    tenantName: "Ажунебі",
    subdomain: tenant_id || "default",
    branding: {},
    rooms: [],
    discounts: [],
    customPrices: {},
  };

  const ua = (await headers()).get("user-agent") || "";
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const variant = isMobile ? "mobile" : "desktop";
  const stylesheet =
    variant === "mobile" ? "/public-site-mobile.css" : "/public-site-desktop.css";

  return (
    <>
      <link rel="stylesheet" href={stylesheet} />
      <PublicBookPage data={data} variant={variant} />
    </>
  );
}
