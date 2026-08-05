import { PublicBookPage } from "@/components/public/PublicBookPage";
import type { PublicTenantPayload } from "@/lib/public-booking/types";

/** ISR shell — no headers()/force-dynamic so Vercel can cache HTML for ~5 min. */
export const revalidate = 300;

type PageProps = {
  params: Promise<{ tenant_id: string }>;
};

/**
 * Paint shell immediately. Do NOT await backend on SSR — under load
 * fetchPublicTenantData can fail and notFound() becomes an intermittent 404.
 * Client PublicBookingProvider loads initData (CDN-cached 5 min) with retries.
 * Mobile vs desktop CSS + variant are chosen on the client (sites are ssr:false).
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

  return <PublicBookPage data={data} />;
}
