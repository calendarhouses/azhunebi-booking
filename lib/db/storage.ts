import { createServiceSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "media";
const MAX_BYTES = 2 * 1024 * 1024;

let bucketReady: Promise<string> | null = null;

function mediaBucket(): string {
  return process.env.SUPABASE_MEDIA_BUCKET?.trim() || DEFAULT_BUCKET;
}

function sanitizeStoragePath(raw: string): string {
  const path = String(raw || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
  if (!path || path.includes("..") || path.startsWith("/") || /[^\w./\-+]/.test(path)) {
    throw new Error("Некоректний шлях файлу");
  }
  if (path.length > 400) throw new Error("Занадто довгий шлях файлу");
  return path;
}

async function ensurePublicMediaBucket(sb: SupabaseClient, bucket: string): Promise<void> {
  const { data: existing } = await sb.storage.getBucket(bucket);
  if (existing) {
    if (!existing.public) {
      await sb.storage.updateBucket(bucket, { public: true });
    }
    return;
  }
  const { error } = await sb.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ],
  });
  // Race: another process created it
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Не вдалося створити storage bucket: ${error.message}`);
  }
}

async function readyBucket(): Promise<{ sb: SupabaseClient; bucket: string }> {
  const sb = createServiceSupabase();
  const bucket = mediaBucket();
  if (!bucketReady) {
    bucketReady = ensurePublicMediaBucket(sb, bucket)
      .then(() => bucket)
      .catch((err) => {
        bucketReady = null;
        throw err;
      });
  }
  await bucketReady;
  return { sb, bucket };
}

/**
 * Upload already-compressed image bytes (from admin client) to Supabase Storage.
 * Returns a public URL. Does not touch existing Drive URLs on rooms.
 */
export async function uploadMediaBase64(params: {
  path: string;
  base64: string;
  contentType?: string;
  upsert?: boolean;
}): Promise<{ publicUrl: string; path: string; bucket: string }> {
  const path = sanitizeStoragePath(params.path);
  const base64 = String(params.base64 || "").replace(/^data:[^;]+;base64,/, "");
  if (!base64) throw new Error("Порожній файл");

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("Порожній файл");
  if (buffer.length > MAX_BYTES) {
    throw new Error("Файл завеликий (макс. 2 МБ після стиснення)");
  }

  const contentType = String(params.contentType || "image/webp").trim() || "image/webp";
  if (!contentType.startsWith("image/")) {
    throw new Error("Дозволені лише зображення");
  }

  const { sb, bucket } = await readyBucket();
  const { error } = await sb.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: params.upsert === true,
    cacheControl: "31536000",
  });
  if (error) throw new Error(error.message || "Помилка завантаження в Storage");

  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Не вдалося отримати публічний URL");

  return { publicUrl: data.publicUrl, path, bucket };
}
