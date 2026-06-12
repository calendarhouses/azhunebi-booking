import imageCompression from "browser-image-compression";

const WEBP_OPTIONS = {
  maxSizeMB: 4,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/webp" as const,
  initialQuality: 0.82,
};

function toWebpFileName(originalName: string): string {
  const baseName = originalName.replace(/\.[^.]+$/, "") || "image";
  return `${baseName}.webp`;
}

export async function compressImageToWebp(file: File): Promise<File> {
  const compressed = await imageCompression(file, WEBP_OPTIONS);
  return new File([compressed], toWebpFileName(file.name), {
    type: "image/webp",
    lastModified: Date.now(),
  });
}
