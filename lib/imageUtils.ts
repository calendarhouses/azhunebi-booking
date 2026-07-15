const MAX_DIMENSION = 1280;
const TARGET_BYTES = 250 * 1024;
const MIN_QUALITY = 0.5;
const START_QUALITY = 0.82;

export type CompressedImage = {
  blob: Blob;
  type: string;
  ext: string;
};

/** Returns a human-readable file size string, e.g. "142 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Detects whether canvas can actually ENCODE WebP.
 * iOS / Telegram WebView often supports decoding but NOT encoding —
 * in that case toDataURL silently falls back to PNG (huge, lossless),
 * which is why "compressed" files came out bigger than the original.
 */
function canEncodeWebP(): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Не вдалося прочитати зображення"));
    };

    img.src = objectUrl;
  });
}

function scaleDimensions(width: number, height: number, max: number) {
  if (width <= max && height <= max) return { w: width, h: height };
  if (width >= height) {
    return { w: max, h: Math.round((height * max) / width) };
  }
  return { w: Math.round((width * max) / height), h: max };
}

function drawToCanvas(img: HTMLImageElement, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  return canvas;
}

function encode(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function fileExt(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return file.type.includes("png") ? "png" : "jpg";
}

/**
 * Compresses an image reliably across browsers (incl. iOS WebView).
 * - Uses WebP only when the browser can truly encode it, otherwise JPEG.
 * - Scales down to MAX_DIMENSION and reduces quality to hit TARGET_BYTES.
 * - Never returns a file larger than the original; if it would, the original
 *   (already efficient) file is kept as-is.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const img = await loadImage(file);

  const useWebP = canEncodeWebP();
  const type = useWebP ? "image/webp" : "image/jpeg";
  const ext = useWebP ? "webp" : "jpg";

  let { w, h } = scaleDimensions(img.naturalWidth, img.naturalHeight, MAX_DIMENSION);
  let best: Blob | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const canvas = drawToCanvas(img, w, h);
    let quality = START_QUALITY;
    let blob = await encode(canvas, type, quality);

    while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
      quality = Math.round((quality - 0.1) * 100) / 100;
      blob = await encode(canvas, type, quality);
    }

    if (blob && (!best || blob.size < best.size)) best = blob;
    if (best && best.size <= TARGET_BYTES) break;

    w = Math.round(w * 0.8);
    h = Math.round(h * 0.8);
  }

  if (!best || best.size >= file.size) {
    return { blob: file, type: file.type || "image/jpeg", ext: fileExt(file) };
  }

  return { blob: best, type, ext };
}
