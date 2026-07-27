import type { ReactNode } from "react";
import { BRAND_ICONS } from "@/lib/brandIcons";

/**
 * Ізольований root-layout для публічного сайту бронювання.
 * Не містить Tailwind globals.css та шрифтів Geist.
 * Підключає власні стилі та шрифти від дизайну.
 */
export default function BookRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#F7F5F2" />
        <meta name="application-name" content="АЖ У НЕБІ" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="АЖ У НЕБІ" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href={BRAND_ICONS.favicon} sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href={BRAND_ICONS.icon32} />
        <link rel="icon" type="image/png" sizes="192x192" href={BRAND_ICONS.icon192} />
        <link rel="apple-touch-icon" sizes="180x180" href={BRAND_ICONS.icon180} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link href="/public-booking-overrides.css" rel="stylesheet" />
      </head>
      <body className="public-booking-page">{children}</body>
    </html>
  );
}
