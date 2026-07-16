import type { Metadata, Viewport } from "next";
import "flatpickr/dist/flatpickr.min.css";
import "../admin-isolation.css";
/* Desktop styles first — shared views/timeline need them; mobile CSS overrides shell. */
import "@/components/admin/desktop/admin-desktop.css";
import "@/components/admin/desktop/settings/settings-side-drawer.css";
import "@/components/admin/desktop/settings/settings-discounts.css";
import "@/components/admin/mobile/admin-mobile.css";
import "@/components/admin/desktop/settings/settings-additional-services.css";

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
