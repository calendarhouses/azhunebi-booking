import type { Metadata } from "next";

/** Shared PWA / favicon assets for admin + public booking. */

export const BRAND_ICON_GREEN = "#095237";

export const BRAND_ICONS = {
  favicon: "/favicon.ico",
  /** Transparent marks — browser tab only. */
  icon16: "/images/brand-icon-16.png",
  icon32: "/images/brand-icon-32.png",
  icon180: "/images/brand-icon-180.png",
  icon192: "/images/brand-icon-192.png",
  icon512: "/images/brand-icon-512.png",
  /** Opaque green plate — Android / iOS home-screen shortcuts. */
  home180: "/images/brand-home-icon-180.png",
  home192: "/images/brand-home-icon-192.png",
  home512: "/images/brand-home-icon-512.png",
  /** Live logo from «Моя сторінка» (?home=1 adds green plate). */
  live: "/api/brand/icon",
} as const;

/**
 * Browser tab icons stay transparent.
 * Apple touch / PWA install icons use the green home plate (OS rules).
 */
export const brandIconMetadata: Metadata["icons"] = {
  icon: [
    { url: BRAND_ICONS.icon32, sizes: "32x32", type: "image/png" },
    { url: BRAND_ICONS.icon192, sizes: "192x192", type: "image/png" },
    { url: BRAND_ICONS.favicon, sizes: "any" },
  ],
  apple: [{ url: BRAND_ICONS.home180, sizes: "180x180", type: "image/png" }],
  shortcut: [{ url: BRAND_ICONS.home192, type: "image/png" }],
};

export const brandManifestIcons = [
  {
    src: `${BRAND_ICONS.live}?w=192&home=1`,
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: `${BRAND_ICONS.live}?w=512&home=1`,
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
  {
    src: `${BRAND_ICONS.live}?w=512&home=1`,
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];
