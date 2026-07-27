"use client";

import { useEffect } from "react";
import { toImageDisplaySrc } from "@/lib/driveImageUrl";
import { BRAND_ICONS } from "@/lib/brandIcons";

type Props = {
  /** Branding logo from «Моя сторінка»; falls back to packaged transparent mark. */
  logoUrl?: string | null;
};

function upsertLink(rel: string, href: string, attrs: Record<string, string> = {}) {
  const sizes = attrs.sizes;
  let link: HTMLLinkElement | null = null;

  if (sizes) {
    link = document.head.querySelector(
      `link[rel="${rel}"][sizes="${sizes}"]`
    ) as HTMLLinkElement | null;
  }
  if (!link && (rel === "shortcut icon" || rel === "apple-touch-icon")) {
    link = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }

  for (const [k, v] of Object.entries(attrs)) {
    link.setAttribute(k, v);
  }
  link.href = href;
}

/**
 * Tab icons: transparent logo.
 * Home-screen / apple-touch: green plate (Android & iOS expect opaque icons).
 */
export function BrandFavicon({ logoUrl }: Props) {
  useEffect(() => {
    const branded = logoUrl ? toImageDisplaySrc(logoUrl, 512) : "";
    const icon32 = branded || BRAND_ICONS.icon32;
    const icon192 = branded || BRAND_ICONS.icon192;
    // Always opaque green for iOS/Android home-screen installs.
    const apple = `${BRAND_ICONS.live}?w=180&home=1`;

    upsertLink("icon", icon32, { type: "image/png", sizes: "32x32" });
    upsertLink("icon", icon192, { type: "image/png", sizes: "192x192" });
    upsertLink("shortcut icon", icon192, { type: "image/png" });
    upsertLink("apple-touch-icon", apple, { sizes: "180x180" });
  }, [logoUrl]);

  return null;
}
