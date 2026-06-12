import { normalizeDriveImageUrl } from "@/lib/driveImageUrl";
import { compressImageToWebp } from "@/lib/admin/onboarding/mediaCompression";
import { getStoredAuthToken, uploadFile } from "@/lib/gas-api";

function logoPath(tenantId: string): string {
  return `branding/${tenantId}/logo.webp`;
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

/** Стиснення в WebP у браузері, завантаження через GAS API, повертає публічний URL. */
export async function uploadTenantLogo(file: File, tenantId: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Оберіть файл зображення");
  }
  const webp = await compressImageToWebp(file);
  const path = logoPath(tenantId);
  const base64 = await fileToBase64(webp);

  const { publicUrl } = await uploadFile({
    tenantId,
    path,
    base64,
    contentType: "image/webp",
    upsert: true,
    authToken: getStoredAuthToken(),
  });

  return normalizeDriveImageUrl(publicUrl);
}
