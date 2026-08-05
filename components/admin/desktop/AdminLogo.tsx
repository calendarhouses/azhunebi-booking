import { toImageDisplaySrc } from "@/lib/driveImageUrl";
import {
  ADMIN_PRELOADER_LOGO_ALT,
  ADMIN_PRELOADER_LOGO_SRC,
} from "@/lib/admin/adminPreloaderLogo";

type AdminLogoVariant = "sidebar" | "auth" | "preloader";

const AUTH_SIZE = { height: 44, maxWidth: 240 } as const;

export function AdminLogo({
  variant = "sidebar",
  className = "",
  logoUrl,
  alt,
}: {
  variant?: AdminLogoVariant;
  className?: string;
  logoUrl?: string | null;
  alt?: string | null;
}) {
  // Never fall back to /images/logo.png (ХАТА) — use АЖ У НЕБІ preloader mark.
  const defaultSrc = ADMIN_PRELOADER_LOGO_SRC;
  const src = logoUrl ? toImageDisplaySrc(logoUrl, 480) : defaultSrc;
  const label =
    String(alt || (variant === "preloader" ? ADMIN_PRELOADER_LOGO_ALT : "Логотип")).trim() ||
    ADMIN_PRELOADER_LOGO_ALT;
  const cls = `admin-logo admin-logo--${variant}${className ? ` ${className}` : ""}`;

  if (variant === "sidebar") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} className={cls} decoding="async" referrerPolicy="no-referrer" />
    );
  }

  if (variant === "preloader") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        className={cls}
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }

  const { height, maxWidth } = AUTH_SIZE;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label}
      className={cls}
      height={height}
      style={{ height, maxWidth, width: "auto" }}
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}
