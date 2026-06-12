import imageCompression from "browser-image-compression";
import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { getStoredAuthToken, uploadFile } from "@/lib/gas-api";

const COMPRESS_OPTIONS = {
  maxSizeMB: 8,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: "image/webp" as const,
  initialQuality: 0.8,
};

export async function compressRoomPhoto(file: File): Promise<File> {
  const compressed = await imageCompression(file, COMPRESS_OPTIONS);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([compressed], `${baseName}.webp`, { type: "image/webp" });
}

function storagePath(tenantId: string, roomId: number, fileName: string): string {
  return `rooms/${tenantId}/${roomId}/${fileName}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadRoomPhoto(
  file: File,
  tenantId: string,
  roomId: number
): Promise<string> {
  const webp = await compressRoomPhoto(file);
  const fileName = `${crypto.randomUUID()}.webp`;
  const path = storagePath(tenantId, roomId, fileName);
  const base64 = await fileToBase64(webp);

  const { publicUrl } = await uploadFile({
    tenantId,
    path,
    base64,
    contentType: "image/webp",
    authToken: getStoredAuthToken(),
  });

  return normalizeDriveImageUrl(publicUrl);
}

export async function uploadRoomPhotos(
  files: File[],
  tenantId: string,
  roomId: number
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    urls.push(await uploadRoomPhoto(file, tenantId, roomId));
  }
  return urls;
}
