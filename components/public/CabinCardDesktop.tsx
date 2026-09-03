"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicRoom } from "@/lib/public-booking/types";
import {
  formatPriceUa,
  getRoomImages,
  getRoomMinPrice,
  getRoomSubtitle,
} from "@/lib/public-booking/roomHelpers";
import { shouldLoadSlide } from "@/lib/driveImageUrl";
import { CabinFeatures } from "./CabinFeatures";
import { CabinSlideImage } from "./CabinSlideImage";

type Props = {
  room: PublicRoom;
  customPrices: Record<string, Record<string, number>>;
};

export function CabinCardDesktop({ room, customPrices }: Props) {
  const images = getRoomImages(room, { card: true });
  const minPrice = getRoomMinPrice(room, customPrices);
  const [slideIndex, setSlideIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const goSlide = useCallback(
    (dir: number) => {
      setSlideIndex((prev) => (prev + dir + images.length) % images.length);
    },
    [images.length]
  );

  const setSlide = useCallback((idx: number) => {
    setSlideIndex(idx);
  }, []);

  return (
    <div className="cabin-card" ref={cardRef}>
      <div className="slider-wrap" id={`card-slider-${room.id}`}>
        <div className="cabin-badge">{room.desc}</div>
        <div
          className="slider-track"
          id={`track-${room.id}`}
          style={{ transform: `translateX(-${slideIndex * 100}%)` }}
        >
          {images.map((url, i) => (
            <div className="slide" key={`${room.id}-${i}`}>
              {shouldLoadSlide(i, slideIndex, images.length) ? (
                <CabinSlideImage
                  src={url}
                  alt={room.name}
                  loading={i === slideIndex ? "eager" : "lazy"}
                  sizes="(max-width: 1200px) 50vw, 33vw"
                />
              ) : (
                <div className="slide-placeholder" aria-hidden />
              )}
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <>
            <button
              type="button"
              className="slider-btn slider-prev"
              aria-label="Попереднє фото"
              onClick={(e) => {
                e.stopPropagation();
                goSlide(-1);
              }}
            >
              <svg viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              className="slider-btn slider-next"
              aria-label="Наступне фото"
              onClick={(e) => {
                e.stopPropagation();
                goSlide(1);
              }}
            >
              <svg viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="slider-dots" id={`dots-${room.id}`}>
              {images.map((_, i) => (
                <div
                  key={i}
                  className={`sdot${i === slideIndex ? " active" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSlide(i);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSlide(i);
                  }}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="cabin-body">
        <div className="cabin-name">{room.name}</div>
        <div className="cabin-subtitle">{getRoomSubtitle(room)}</div>
        <CabinFeatures room={room} />
        <div className="cabin-meta">
          <div className="cabin-meta-item">
            <svg viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
              />
            </svg>
            До {room.maxCapacity || room.capacity} гостей
          </div>
        </div>
        <div className="cabin-footer-block">
          <div className="price-info">
            <span className="price-label">Вартість</span>
            <span className="price-val">
              від <strong>{formatPriceUa(minPrice)}</strong> грн / ніч
            </span>
          </div>
          <button type="button" className="btn-book" disabled title="Незабаром">
            Забронювати
          </button>
        </div>
      </div>
    </div>
  );
}
