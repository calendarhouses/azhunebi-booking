"use client";

import { toImageDisplaySrc } from "@/lib/driveImageUrl";
import type { ChangeEvent } from "react";

export interface RoomPhotosUploadProps {
  photos: string[];
  busy: boolean;
  roomId: number | null;
  onFilesSelected: (files: FileList) => void;
}

export function RoomPhotosUpload({
  photos,
  busy,
  roomId,
  onFilesSelected,
}: RoomPhotosUploadProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list?.length) onFilesSelected(list);
    e.target.value = "";
  };

  return (
    <div className="form-group" style={{ marginTop: 8 }}>
      <label>Фотографії котеджу:</label>
      {photos.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {photos.map((url) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "block",
                width: 72,
                height: 72,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid #E5E7EB",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={toImageDisplaySrc(url, 480)}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                referrerPolicy="no-referrer"
              />
            </a>
          ))}
        </div>
      ) : null}

      <input
        type="file"
        accept="image/*"
        multiple
        disabled={busy || roomId == null}
        onChange={handleChange}
        style={{ width: "100%", fontSize: 14 }}
      />

      {roomId == null ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B7280" }}>
          Збережіть котедж, щоб додати фото (або відкрийте існуючий для редагування).
        </p>
      ) : null}

      {busy ? (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13,
            color: "#556B2F",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          role="status"
          aria-live="polite"
        >
          <span className="room-photo-spinner" aria-hidden />
          Оптимізація та завантаження...
        </p>
      ) : (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9CA3AF" }}>
          До 1920px, WebP, якість 80%. Можна обрати кілька файлів.
        </p>
      )}
    </div>
  );
}
