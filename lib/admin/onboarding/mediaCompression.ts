import {
  compressImage,
  compressLogo,
  formatFileSize,
  type CompressedImage,
} from "@/lib/imageUtils";

export { compressImage, compressLogo, formatFileSize, type CompressedImage };

export const MAX_COMPRESSED_BYTES = 1.5 * 1024 * 1024;
export const COMPRESS_FAIL_MESSAGE = "Не вдалося стиснути фото. Спробуйте інше.";

export function compressedToFile(compressed: CompressedImage, originalName: string): File {
  const baseName = originalName.replace(/\.[^.]+$/, "") || "image";
  return new File([compressed.blob], `${baseName}.${compressed.ext}`, {
    type: compressed.type,
    lastModified: Date.now(),
  });
}

/** Canvas-based compression with WebP/JPEG fallback — same approach as azhunebi-menu. */
export async function compressImageForUpload(file: File): Promise<File> {
  console.log(`[image] before: ${Math.round(file.size / 1024)} KB`);

  const compressed = await compressImage(file);

  console.log(
    `[image] after: ${Math.round(compressed.blob.size / 1024)} KB (${compressed.type})`
  );

  if (compressed.blob.size > MAX_COMPRESSED_BYTES) {
    throw new Error(COMPRESS_FAIL_MESSAGE);
  }

  return compressedToFile(compressed, file.name);
}

/** Logo upload: keep transparency, never bake a white background. */
export async function compressLogoForUpload(file: File): Promise<File> {
  console.log(`[logo] before: ${Math.round(file.size / 1024)} KB`);

  const compressed = await compressLogo(file);

  console.log(
    `[logo] after: ${Math.round(compressed.blob.size / 1024)} KB (${compressed.type})`
  );

  if (compressed.blob.size > MAX_COMPRESSED_BYTES) {
    throw new Error(COMPRESS_FAIL_MESSAGE);
  }

  return compressedToFile(compressed, file.name);
}

/** @deprecated Use compressImageForUpload */
export const compressImageToWebp = compressImageForUpload;
