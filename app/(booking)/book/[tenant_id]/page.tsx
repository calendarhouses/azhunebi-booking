import { headers } from "next/headers";
import { PublicBookPage } from "@/components/public/PublicBookPage";
import type { PublicTenantPayload } from "@/lib/public-booking/types";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenant_id: string }>;
};

/**
 * Do NOT await GAS on SSR. Blocking on initData made TTFB 45–60s+ and stacked
 * the Apps Script queue whenever several visitors opened the site.
 * Shell HTML + loading.tsx/preloader paint instantly; client loads /api/public/init.
 */
function shellTenant(tenantId: string): PublicTenantPayload {
  return {
    tenantId,
    tenantName: "АЖ У НЕБІ",
    subdomain: tenantId,
    branding: { site_title: "АЖ У НЕБІ" },
    rooms: [],
    discounts: [],
    customPrices: {},
  };
}

export default async function BookTenantPage({ params }: PageProps) {
  const { tenant_id } = await params;

  const ua = (await headers()).get("user-agent") || "";
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const variant = isMobile ? "mobile" : "desktop";
  const stylesheet =
    variant === "mobile" ? "/public-site-mobile.css" : "/public-site-desktop.css";

  return (
    <>
      <link rel="stylesheet" href={stylesheet} />
      <PublicBookPage data={shellTenant(tenant_id)} variant={variant} />
    </>
  );
}
