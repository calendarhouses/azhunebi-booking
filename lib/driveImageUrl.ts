/** Публічні URL Google Drive для збереження в таблиці (lh3). */
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
    return `https://lh3.googleusercontent.com/d/${fileId}=w1920`;
  }

  return trimmed.split("?")[0].split("#")[0];
}

/** URL для <img src> — same-origin проксі, щоб уникнути блокування lh3 у браузері. */
export function toImageDisplaySrc(url: string | undefined | null): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("/api/image")) return trimmed;

  const fileId = extractDriveFileId(normalizeDriveImageUrl(trimmed));
  if (fileId) {
    return `/api/image?id=${encodeURIComponent(fileId)}`;
  }

  if (trimmed.startsWith("/")) return trimmed;
  return normalizeDriveImageUrl(trimmed);
}

export function normalizeDriveImageUrls(urls: string[] | undefined | null): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.map((u) => normalizeDriveImageUrl(u)).filter(Boolean);
}
