import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PublicBookPage } from "@/components/public/PublicBookPage";
import { loadPublicBoot } from "@/lib/public-booking/loadPublicBoot";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenant_id: string }>;
};

export default async function BookTenantPage({ params }: PageProps) {
  const { tenant_id } = await params;
  const boot = await loadPublicBoot(tenant_id);

  if (!boot) {
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
      <PublicBookPage
        data={boot.tenant}
        variant={variant}
        initialInit={{
          settings: boot.init.settings,
          bookings: boot.init.bookings,
        }}
      />
    </>
  );
}
