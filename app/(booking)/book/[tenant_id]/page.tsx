import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PublicBookPage } from "@/components/public/PublicBookPage";
import { fetchPublicTenantData } from "@/lib/public-booking/fetchPublicTenantData";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenant_id: string }>;
};

export default async function BookTenantPage({ params }: PageProps) {
  const { tenant_id } = await params;
  const data = await fetchPublicTenantData(tenant_id);

  if (!data) {
    notFound();
  }

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
