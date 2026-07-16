import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Панель Управління — АЖ У НЕБІ",
    short_name: "Адмінка",
    description: "Мобільна панель управління бронюваннями",
    start_url: "/admin/mobile",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F8F6",
    theme_color: "#556B2F",
    lang: "uk",
    icons: [
      {
        src: "/images/admin-preloader-logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/admin-preloader-logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/admin-preloader-logo.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
