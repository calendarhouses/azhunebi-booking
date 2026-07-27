import type { Metadata } from "next";

/** Shared PWA / favicon assets for admin + public booking. */

export const BRAND_ICON_GREEN = "#095237";

export const BRAND_ICONS = {
  favicon: "/favicon.ico",
  icon16: "/images/brand-icon-16.png",
  icon32: "/images/brand-icon-32.png",
  icon180: "/images/brand-icon-180.png",
  icon192: "/images/brand-icon-192.png",
  icon512: "/images/brand-icon-512.png",
} as const;

export const brandIconMetadata: Metadata["icons"] = {
  icon: [
    { url: BRAND_ICONS.favicon },
    { url: BRAND_ICONS.icon32, sizes: "32x32", type: "image/png" },
    { url: BRAND_ICONS.icon192, sizes: "192x192", type: "image/png" },
  ],
  apple: [{ url: BRAND_ICONS.icon180, sizes: "180x180", type: "image/png" }],
  shortcut: [{ url: BRAND_ICONS.icon192 }],
};

export const brandManifestIcons = [
  {
    src: BRAND_ICONS.icon192,
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: BRAND_ICONS.icon512,
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
  {
    src: BRAND_ICONS.icon512,
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];
