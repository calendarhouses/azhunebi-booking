/** Публічні URL Google Drive для збереження в таблиці (lh3). */

/** Allowed proxy widths — must stay in sync with `/api/image` buckets. */
export const IMAGE_WIDTH_CARD = 720;
export const IMAGE_WIDTH_FULL = 1080;
export const IMAGE_WIDTH_LOGO = 480;

export function extractDriveFileId(url: string | undefined | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const lh3Match = trimmed.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (lh3Match) return lh3Match[1];

  const idMatch = trimmed.match(/(?:[?&]id=|\/d\/)([a-zA-Z0-9_-]+)/);
  return idMatch ? idMatch[1] : null;
}

/** Нормалізує URL для збереження в GAS / Google Sheets. */
export function normalizeDriveImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;

  const fileId = extractDriveFileId(trimmed);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w${IMAGE_WIDTH_FULL}`;
  }

  return trimmed.split("?")[0].split("#")[0];
}

function snapPublicWidth(maxWidth: number): number {
  if (maxWidth <= IMAGE_WIDTH_LOGO) return IMAGE_WIDTH_LOGO;
  if (maxWidth <= IMAGE_WIDTH_CARD) return IMAGE_WIDTH_CARD;
  return IMAGE_WIDTH_FULL;
}

/** URL для <img src> — same-origin проксі, щоб уникнути блокування lh3 у браузері. */
export function toImageDisplaySrc(
  url: string | undefined | null,
  maxWidth = IMAGE_WIDTH_FULL
): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;

  const width = snapPublicWidth(Math.max(320, Math.min(maxWidth, IMAGE_WIDTH_FULL)));
  const fileId = extractDriveFileId(normalizeDriveImageUrl(trimmed));
  if (fileId) {
    return `/api/image?id=${encodeURIComponent(fileId)}&w=${width}`;
  }

  if (trimmed.startsWith("/api/image")) {
    // Re-snap any legacy w=1920 URLs through the same buckets.
    try {
      const u = new URL(trimmed, "https://local.invalid");
      const id = u.searchParams.get("id");
      if (id) {
        const wRaw = Number(u.searchParams.get("w") || maxWidth);
        const w = snapPublicWidth(Number.isFinite(wRaw) ? wRaw : maxWidth);
        return `/api/image?id=${encodeURIComponent(id)}&w=${w}`;
      }
    } catch {
      /* keep as-is */
    }
    return trimmed;
  }
  if (trimmed.startsWith("/")) return trimmed;
  return normalizeDriveImageUrl(trimmed);
}

/** Компактні превʼю для карток котеджів (~720px). */
export function toImageCardSrc(url: string | undefined | null): string {
  return toImageDisplaySrc(url, IMAGE_WIDTH_CARD);
}

export function normalizeDriveImageUrls(urls: string[] | undefined | null): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.map((u) => normalizeDriveImageUrl(u)).filter(Boolean);
}

/** Only current ±1 slides should hit the network (circular). */
export function shouldLoadSlide(
  index: number,
  current: number,
  total: number,
  windowSize = 1
): boolean {
  if (total <= 0) return false;
  if (total <= windowSize * 2 + 1) return true;
  const dist = Math.min(
    Math.abs(index - current),
    total - Math.abs(index - current)
  );
  return dist <= windowSize;
}
