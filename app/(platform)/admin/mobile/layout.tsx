import type { Metadata, Viewport } from "next";
import "flatpickr/dist/flatpickr.min.css";
import "../admin-isolation.css";
import "@/components/admin/admin-tokens.css";
import "@/components/admin/admin-shared-ui.css";
import "@/components/admin/desktop/settings/settings-side-drawer.css";
import "@/components/admin/desktop/settings/settings-discounts.css";
import "@/components/admin/desktop/settings/settings-additional-services.css";
import "@/components/admin/mobile/admin-mobile.css";

export const metadata: Metadata = {
  title: "Панель Управління",
  description: "Мобільна панель управління",
  appleWebApp: { title: "Панель Управління" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function AdminMobileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
