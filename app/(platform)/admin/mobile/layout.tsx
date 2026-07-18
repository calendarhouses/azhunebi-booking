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
  applicationName: "Адмінка",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Адмінка",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [{ url: "/images/admin-preloader-logo.png", type: "image/png" }],
    apple: [{ url: "/images/admin-preloader-logo.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#556B2F" },
    { media: "(prefers-color-scheme: dark)", color: "#556B2F" },
  ],
};

export default function AdminMobileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
