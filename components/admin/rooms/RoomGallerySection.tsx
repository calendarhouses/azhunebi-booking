"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { toImageDisplaySrc } from "@/lib/driveImageUrl";
import { RoomPhotoLightbox } from "./RoomPhotoLightbox";

type RoomGallerySectionProps = {
  photos: string[];
  roomId: number | null;
  busy: boolean;
  onFiles: (files: FileList | File[] | undefined) => void | Promise<void>;
  onPhotosChange: (photos: string[]) => void | Promise<void>;
};

const DRAG_CLICK_THRESHOLD_PX = 6;

function Spinner() {
  return (
    <svg className="khata-onboarding__spinner" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  );
}

function previewOrder(length: number, from: number | null, over: number | null): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  if (from == null || over == null || from === over || from >= length || over >= length) {
    return indices;
  }
  const next = [...indices];
  const [moved] = next.splice(from, 1);
  next.splice(over, 0, moved);
  return next;
}

export function RoomGallerySection({
  photos,
  roomId,
  busy,
  onFiles,
  onPhotosChange,
}: RoomGallerySectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragFromRef = useRef<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);
  const pointerMovedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number; idx: number } | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const onPhotosChangeRef = useRef(onPhotosChange);
  onPhotosChangeRef.current = onPhotosChange;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  dropIndexRef.current = dropIndex;
  const canUpload = roomId != null && !busy;

  const displayOrder = useMemo(
    () => previewOrder(photos.length, dragIndex, dropIndex),
    [photos.length, dragIndex, dropIndex]
  );

  const removePhoto = (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    void onPhotosChange(next);
  };

  const startDrag = (index: number, clientX: number, clientY: number) => {
    if (busy) return;
    pointerMovedRef.current = false;
    pointerStartRef.current = { x: clientX, y: clientY, idx: index };
    dragFromRef.current = index;
    setDragIndex(index);
    setDropIndex(index);
  };

  const finishDrag = (commit: boolean) => {
    const from = dragFromRef.current;
    const to = dropIndexRef.current;
    const start = pointerStartRef.current;

    if (commit && pointerMovedRef.current && from !== null && to !== null) {
      const list = photosRef.current;
      if (from !== to && from >= 0 && to >= 0 && from < list.length && to < list.length) {
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        void onPhotosChangeRef.current(next);
      }
    } else if (!pointerMovedRef.current && start !== null) {
      const url = photosRef.current[start.idx];
      if (url) setLightboxUrl(toImageDisplaySrc(url));
    }

    dragFromRef.current = null;
    pointerStartRef.current = null;
    pointerMovedRef.current = false;
    setDragIndex(null);
    setDropIndex(null);
  };

  useEffect(() => {
    if (dragIndex === null) return;

    const onPointerMove = (e: PointerEvent) => {
      const start = pointerStartRef.current;
      if (start) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (dx * dx + dy * dy > DRAG_CLICK_THRESHOLD_PX * DRAG_CLICK_THRESHOLD_PX) {
          pointerMovedRef.current = true;
        }
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const wrap = el?.closest<HTMLElement>("[data-photo-index]");
      if (!wrap) return;
      const idx = Number(wrap.dataset.photoIndex);
      if (Number.isFinite(idx) && idx !== dragFromRef.current) {
        setDropIndex(idx);
      }
    };

    const onPointerUp = () => finishDrag(true);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [dragIndex]);

  return (
    <>
      <div
        className="khata-room-gallery"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.currentTarget.classList.add("is-dragover");
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove("is-dragover");
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("is-dragover");
          if (e.dataTransfer.files?.length && canUpload) {
            void onFiles(e.dataTransfer.files);
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          disabled={!canUpload}
          onChange={(e) => {
            void onFiles(e.target.files || undefined);
            e.currentTarget.value = "";
          }}
        />

        {photos.length > 0 ? (
          <div className={`khata-room-gallery__grid${dragIndex != null ? " is-reordering" : ""}`}>
            {displayOrder.map((photoIdx) => {
              const url = photos[photoIdx];
              const isMain = photoIdx === 0;
              const isDragging = dragIndex === photoIdx;

              return (
                <div
                  key={`${url}-${photoIdx}`}
                  data-photo-index={photoIdx}
                  className={`khata-room-gallery__thumb-wrap${isMain ? " is-main" : ""}${isDragging ? " is-dragging" : ""}`}
                  onPointerDown={(e) => {
                    if (busy || e.button !== 0) return;
                    if ((e.target as HTMLElement).closest(".khata-room-gallery__remove")) return;
                    e.preventDefault();
                    startDrag(photoIdx, e.clientX, e.clientY);
                  }}
                >
                  <div className="khata-room-gallery__thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={toImageDisplaySrc(url)} alt={`Фото ${photoIdx + 1}`} draggable={false} referrerPolicy="no-referrer" />
                    {isMain ? (
                      <span className="khata-room-gallery__main-tip">Основне фото</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="khata-room-gallery__remove"
                    aria-label="Видалити фото"
                    disabled={busy}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removePhoto(photoIdx);
                    }}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
            {photos.length < 15 && canUpload ? (
              <button
                type="button"
                className="khata-room-gallery__add"
                onClick={() => inputRef.current?.click()}
              >
                <UploadCloud className="h-5 w-5" strokeWidth={2} />
                <span>Додати</span>
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="khata-room-gallery__empty"
            disabled={!canUpload}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <>
                <Spinner />
                <span>Завантаження…</span>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8" strokeWidth={1.75} />
                <span className="khata-room-gallery__empty-title">
                  {roomId == null
                    ? "Спочатку збережи основну інформацію"
                    : "Перетягни фото сюди або натисни для вибору"}
                </span>
                {roomId != null ? (
                  <span className="khata-room-gallery__empty-hint">До 15 зображень, WebP або JPEG</span>
                ) : null}
              </>
            )}
          </button>
        )}

        {busy && photos.length === 0 ? (
          <div className="khata-room-gallery__busy" role="status">
            <Spinner />
            <span>Оптимізація та завантаження…</span>
          </div>
        ) : null}
      </div>

      <RoomPhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </>
  );
}
