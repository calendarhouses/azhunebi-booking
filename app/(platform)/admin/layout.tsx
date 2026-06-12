import type { Metadata } from "next";
import Script from "next/script";
import { AdminShell } from "@/components/auth/AdminShell";
import "./admin-isolation.css";

export const metadata: Metadata = {
  title: "BOSO | Панель Управління",
  description: "Панель управління BOSO",
  appleWebApp: { title: "BOSO" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminShell>
      <div className="admin-layout-shell">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js" strategy="afterInteractive" />
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      {/* GOOGLE_CLIENT_ID — підключити пізніше; не завантажувати gsi з реальним client id */}
      {/* <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" /> */}
      <Script src="/auth.js" strategy="afterInteractive" />
      </div>
    </AdminShell>
  );
}
