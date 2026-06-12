import type { ReactNode } from "react";

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
