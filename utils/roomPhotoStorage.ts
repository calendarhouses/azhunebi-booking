import { compressImageForUpload } from "@/lib/admin/onboarding/mediaCompression";
import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { getStoredAuthToken, uploadFile } from "@/lib/gas-api";

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

function fileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "webp" || fromName === "jpg" || fromName === "jpeg") return fromName;
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/jpeg") return "jpg";
  return "webp";
}

export async function uploadRoomPhoto(
  file: File,
  tenantId: string,
  roomId: number
): Promise<string> {
  const compressed = await compressImageForUpload(file);
  const ext = fileExtension(compressed);
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const path = storagePath(tenantId, roomId, fileName);
  const base64 = await fileToBase64(compressed);

  const { publicUrl } = await uploadFile({
    tenantId,
    path,
    base64,
    contentType: compressed.type,
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
