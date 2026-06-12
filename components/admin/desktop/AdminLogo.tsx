const LOGO_SRC = "/images/logo.png";

type AdminLogoVariant = "sidebar" | "auth" | "preloader";

const AUTH_PRELOADER_SIZE: Record<"auth" | "preloader", { height: number; maxWidth: number }> = {
  auth: { height: 44, maxWidth: 240 },
  preloader: { height: 48, maxWidth: 280 },
};

export function AdminLogo({
  variant = "sidebar",
  className = "",
}: {
  variant?: AdminLogoVariant;
  className?: string;
}) {
  const cls = `admin-logo admin-logo--${variant}${className ? ` ${className}` : ""}`;

  if (variant === "sidebar") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={LOGO_SRC} alt="ХАТА" className={cls} decoding="async" />
    );
  }

  const { height, maxWidth } = AUTH_PRELOADER_SIZE[variant];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="ХАТА"
      className={cls}
      height={height}
      style={{ height, maxWidth, width: "auto" }}
      decoding="async"
    />
  );
}
