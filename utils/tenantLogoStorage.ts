import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { getStoredAuthToken, uploadFile } from "@/lib/gas-api";

function logoPath(tenantId: string, ext: string): string {
  return `branding/${tenantId}/logo.${ext}`;
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

function logoExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "webp" || fromName === "png" || fromName === "jpg" || fromName === "jpeg") {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
}

/** Завантажує вже стиснуте зображення через GAS API, повертає публічний URL. */
export async function uploadTenantLogo(file: File, tenantId: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Оберіть файл зображення");
  }
  const ext = logoExtension(file);
  const path = logoPath(tenantId, ext);
  const base64 = await fileToBase64(file);

  const { publicUrl } = await uploadFile({
    tenantId,
    path,
    base64,
    contentType: file.type,
    upsert: true,
    authToken: getStoredAuthToken(),
  });

  return normalizeDriveImageUrl(publicUrl);
}
