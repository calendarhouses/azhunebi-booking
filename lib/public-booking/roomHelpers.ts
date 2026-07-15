import type { PublicRoom } from "./types";
import { resolvePublicImageUrl } from "./resolveImageUrl";

const PLACEHOLDER_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect fill="#E5E1DC" width="800" height="600"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="48" fill="#9CA3AF">🏡</text></svg>'
  );

export function getRoomImages(room: PublicRoom, options?: { card?: boolean }): string[] {
  const photos = (room.photos || [])
    .map((u) => resolvePublicImageUrl(u, options?.card ? "card" : "full"))
    .filter((u): u is string => Boolean(u));
  if (photos.length) return photos;
  return [PLACEHOLDER_SVG];
}

export function getRoomMinPrice(
  room: PublicRoom,
  customPrices: Record<string, Record<string, number>>
): number {
  let minPrice = 0;
  const wd = Number(room.priceWeekday) || 0;
  const we = Number(room.priceWeekend) || 0;
  if (wd > 0 && we > 0) minPrice = Math.min(wd, we);
  else if (wd > 0) minPrice = wd;
  else if (we > 0) minPrice = we;

  const custom = customPrices[String(room.id)];
  if (custom) {
    const prices = Object.values(custom).filter((p) => Number(p) > 0);
    if (prices.length) {
      const customMin = Math.min(...prices.map(Number));
      minPrice = minPrice > 0 ? Math.min(minPrice, customMin) : customMin;
    }
  }

  return minPrice;
}

export function formatPriceUa(amount: number): string {
  return amount.toLocaleString("uk-UA");
}

export { formatRoomDisplayName, getRoomBadgeLabel, getRoomSubtitle } from "./roomDisplay";
