import { toImageCardSrc, toImageDisplaySrc } from "@/lib/driveImageUrl";

/** Чи можна безпечно підставити URL у <img src> (без hero.jpg / відносних шляхів). */
export function resolvePublicImageUrl(
  raw: string | undefined | null,
  size: "full" | "card" = "full"
): string | null {
  const url = (raw || "").trim();
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("https://") || url.startsWith("http://") || url.startsWith("/")) {
    const display = size === "card" ? toImageCardSrc(url) : toImageDisplaySrc(url);
    return display || null;
  }
  return null;
}
