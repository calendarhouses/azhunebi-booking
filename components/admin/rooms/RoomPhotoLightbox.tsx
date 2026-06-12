"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type RoomPhotoLightboxProps = {
  url: string | null;
  onClose: () => void;
};

export function RoomPhotoLightbox({ url, onClose }: RoomPhotoLightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [url, onClose]);

  if (!url || !mounted) return null;

  return createPortal(
    <div
      className="khata-photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Перегляд фото"
      onClick={onClose}
    >
      <div className="khata-photo-lightbox__frame" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="khata-photo-lightbox__close"
          aria-label="Закрити"
          onClick={onClose}
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Фото житла у повному розмірі" />
      </div>
    </div>,
    document.body
  );
}
