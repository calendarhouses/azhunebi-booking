"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicRoom } from "@/lib/public-booking/types";
import { getRoomSiteFeatures } from "@/lib/public-booking/desktopRoomContent";
import { DesktopIcons } from "@/lib/public-booking/desktopIcons";
import {
  formatPriceUa,
  getRoomBadgeLabel,
  getRoomImages,
  getRoomMinPrice,
  getRoomSubtitle,
} from "@/lib/public-booking/roomHelpers";
import { formatChildrenPolicyBadge } from "@/components/admin/desktop/settings/additionalServicesLogic";
import { useSliderTrackStyle } from "@/lib/public-booking/useSliderTrackStyle";
import { CabinSlideImage } from "../CabinSlideImage";
import { shouldLoadSlide } from "@/lib/driveImageUrl";

type Props = {
  room: PublicRoom;
  customPrices: Record<string, Record<string, number>>;
  nextFreeLabel: string;
  onBook: () => void;
};

export function DesktopCabinCard({ room, customPrices, nextFreeLabel, onBook }: Props) {
  const images = getRoomImages(room, { card: true });
  const minPrice = getRoomMinPrice(room, customPrices);
  const [slideIndex, setSlideIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const sliderWrapRef = useRef<HTMLDivElement>(null);
  const sliderTrackStyle = useSliderTrackStyle(sliderWrapRef, slideIndex);
  const features = getRoomSiteFeatures(room);
  const subtitle = getRoomSubtitle(room);

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

  const goSlide = (dir: number) => {
    setSlideIndex((prev) => (prev + dir + images.length) % images.length);
  };

  return (
    <div className="cabin-card" ref={cardRef}>
      <div
        className="slider-wrap"
        ref={sliderWrapRef}
        role="button"
        tabIndex={0}
        onClick={onBook}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onBook();
        }}
      >
        {getRoomBadgeLabel(room) ? <div className="cabin-badge">{getRoomBadgeLabel(room)}</div> : null}
        <div className="slider-track" style={sliderTrackStyle}>
          {images.map((url, i) => (
            <div className="slide" key={i}>
              {shouldLoadSlide(i, slideIndex, images.length) ? (
                <CabinSlideImage
                  src={url}
                  alt={room.name}
                  loading={i === slideIndex ? "eager" : "lazy"}
                  fetchPriority={i === slideIndex ? "high" : "auto"}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  onError={(e) => {
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML =
                        '<div class="slide-placeholder">🏡</div>';
                    }
                  }}
                />
              ) : (
                <div className="slide-placeholder" aria-hidden />
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="slider-btn slider-prev"
          onClick={(e) => {
            e.stopPropagation();
            goSlide(-1);
          }}
        >
          {DesktopIcons.chevronLeft}
        </button>
        <button
          type="button"
          className="slider-btn slider-next"
          onClick={(e) => {
            e.stopPropagation();
            goSlide(1);
          }}
        >
          {DesktopIcons.chevronRight}
        </button>
        <div className="slider-dots">
          {images.map((_, i) => (
            <div
              key={i}
              className={`sdot ${i === slideIndex ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setSlideIndex(i);
              }}
            />
          ))}
        </div>
      </div>

      <div className="cabin-body">
        <div className="cabin-name">{room.name}</div>
        {subtitle ? <div className="cabin-subtitle">{subtitle}</div> : null}

        {features.length ? (
          <div className="premium-features">
            {features.map((item, idx) => (
              <div key={idx} className="feature-item">
                {item.icon}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="cabin-meta">
          <div className="cabin-meta-item">
            {DesktopIcons.guests}
            До {room.maxCapacity || room.capacity} гостей
            {formatChildrenPolicyBadge(room) ? (
              <span className="cabin-children-badge">{formatChildrenPolicyBadge(room)}</span>
            ) : null}
          </div>
          <div className="cabin-meta-item">
            {DesktopIcons.calendar}
            Вільний: <span className="cabin-next-free">{nextFreeLabel}</span>
          </div>
        </div>

        <div className="cabin-footer-block">
          <div className="price-info">
            <span className="price-label">Вартість</span>
            <span className="price-val">
              {minPrice > 0 ? (
                <>
                  від <strong>{formatPriceUa(minPrice)}</strong> грн / ніч
                </>
              ) : (
                <strong>Уточнюйте</strong>
              )}
            </span>
          </div>
          <button type="button" className="btn-book" onClick={onBook}>
            Забронювати
          </button>
        </div>
      </div>
    </div>
  );
}
