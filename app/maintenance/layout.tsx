import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/react";

export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <meta charSet="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, viewport-fit=cover"
        />
        <meta name="theme-color" content="#f4f1ea" />
      </head>
      <body style={{ margin: 0 }}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
