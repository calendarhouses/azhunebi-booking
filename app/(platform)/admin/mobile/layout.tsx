import type { Metadata, Viewport } from "next";
import "flatpickr/dist/flatpickr.min.css";
import "../admin-isolation.css";
import "@/components/admin/mobile/admin-mobile.css";

export const metadata: Metadata = {
  title: "BOSO | Панель Управління",
  description: "Мобільна панель управління BOSO",
  appleWebApp: { title: "BOSO" },
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
