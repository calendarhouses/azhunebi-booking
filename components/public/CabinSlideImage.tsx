"use client";

import { useCallback, useState, type CSSProperties, type ImgHTMLAttributes } from "react";

type ObjectFitMode = "contain" | "cover";

function resolveSlideObjectFit(
  img: HTMLImageElement,
  container: HTMLElement
): ObjectFitMode {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  const { naturalWidth: iw, naturalHeight: ih } = img;
  if (!cw || !ch || !iw || !ih) return "contain";

  if (ih > iw * 1.05) return "contain";

  const scaleContain = Math.min(cw / iw, ch / ih);
  const gapX = cw - iw * scaleContain;

  if (gapX / cw <= 0.14) return "cover";
  if (iw / ih >= (cw / ch) * 0.9) return "cover";

  return "contain";
}

const baseStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectPosition: "center",
  display: "block",
};

/**
 * Public cabin/gallery slide. Defaults to lazy decode.
 * Pass `sizes` so browsers pick a sensible resource when srcset is present.
 */
export function CabinSlideImage({
  className = "",
  style,
  onLoad,
  loading = "lazy",
  decoding = "async",
  sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
  fetchPriority,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const [objectFit, setObjectFit] = useState<ObjectFitMode>("contain");

  const applyFit = useCallback((img: HTMLImageElement) => {
    const slide = img.parentElement;
    if (!slide) return;
    setObjectFit(resolveSlideObjectFit(img, slide));
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      loading={loading}
      decoding={decoding}
      sizes={sizes}
      fetchPriority={fetchPriority}
      className={`cabin-slide-img${className ? ` ${className}` : ""}`}
      style={{ ...baseStyle, objectFit, ...style }}
      onLoad={(event) => {
        applyFit(event.currentTarget);
        onLoad?.(event);
      }}
    />
  );
}
