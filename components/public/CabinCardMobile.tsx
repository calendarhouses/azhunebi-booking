"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicRoom } from "@/lib/public-booking/types";
import { buildPublicAmenities, getRoomDescription } from "@/lib/public-booking/desktopRoomContent";
import {
  formatPriceUa,
  getRoomImages,
  getRoomMinPrice,
  getRoomSubtitle,
} from "@/lib/public-booking/roomHelpers";

type Props = {
  room: PublicRoom;
  customPrices: Record<string, Record<string, number>>;
  nextFreeLabel: string;
  onBook: () => void;
};

export function CabinCardMobile({ room, customPrices, nextFreeLabel, onBook }: Props) {
  const images = getRoomImages(room);
  const minPrice = getRoomMinPrice(room, customPrices);
  const { featured, byCategory } = buildPublicAmenities(room);
  const [slideIndex, setSlideIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

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
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const applySlide = useCallback((idx: number) => {
    setSlideIndex(idx);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX;
  };

  const handleTouchEnd = () => {
    if (touchEndX.current === 0 || images.length <= 1) {
      touchStartX.current = 0;
      touchEndX.current = 0;
      return;
    }
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) {
      const dir = diff > 0 ? 1 : -1;
      applySlide((slideIndex + dir + images.length) % images.length);
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <div className="cabin-card" ref={cardRef}>
      <div
        className="slider-wrap"
        id={`card-slider-${room.id}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="cabin-badge">{room.desc}</div>
        <div
          className="slider-track"
          id={`track-${room.id}`}
          style={{ transform: `translateX(-${slideIndex * 100}%)` }}
        >
          {images.map((url, i) => (
            <div className="slide" key={`${room.id}-${i}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={room.name} loading="lazy" />
            </div>
          ))}
        </div>
        {images.length > 1 ? (
          <div className="slider-dots" id={`dots-${room.id}`}>
            {images.map((_, i) => (
              <div key={i} className={`sdot${i === slideIndex ? " active" : ""}`} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="cabin-body">
        <div className="cabin-name">{room.name}</div>
        <div className="cabin-subtitle">{getRoomSubtitle(room)}</div>
        <div className="premium-features">
          {featured.map((item) => (
            <div className="feature-item" key={item.label}>
              {item.icon}
              <span style={{ fontWeight: 600 }}>{item.label}</span>
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            lineHeight: 1.6,
            marginBottom: 14,
            maxHeight: 72,
            overflow: "hidden",
          }}
        >
          {getRoomDescription(room)}
        </p>
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
          <div className="cabin-meta-item">
            <svg viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75"
              />
            </svg>
            Вільний: <span className="cabin-next-free">{nextFreeLabel}</span>
          </div>
        </div>

        {room.rules ? (
          <div
            className="cabin-meta"
            style={{
              background: "#F3F4F6",
              borderRadius: 12,
              padding: 10,
              border: "1px solid var(--border)",
              fontSize: 11,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span>
                <strong>Заїзд</strong> {room.rules.checkInTime || "15:00"}
              </span>
              <span>
                <strong>Виїзд</strong> {room.rules.checkOutTime || "11:00"}
              </span>
            </div>
            <div style={{ marginBottom: 2 }}>
              <strong>Тварини:</strong>{" "}
              {room.rules.pets?.isPetsFriendly ? "дозволені" : "не дозволені"}
            </div>
            {room.rules.pets?.description ? (
              <div style={{ marginBottom: 2 }}>{room.rules.pets.description}</div>
            ) : null}
            {room.rules.selfCheckIn?.enabled ? (
              <div>
                <strong>Самостійне заселення:</strong>{" "}
                {room.rules.selfCheckIn.description || "деталі надішлемо в листі/месенджері"}
              </div>
            ) : null}
          </div>
        ) : null}

        {byCategory.length ? (
          <div style={{ marginTop: 10 }}>
            {byCategory.map((cat) => (
              <div key={cat.id} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                    marginBottom: 2,
                  }}
                >
                  {cat.title}
                </div>
                <div style={{ fontSize: 12, color: "var(--text)" }}>
                  {cat.items.map((a) => a.label).join(" · ")}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="cabin-footer-block">
          <div className="price-info">
            <span className="price-label">Вартість</span>
            <span className="price-val">
              від <strong>{formatPriceUa(minPrice)}</strong> грн / ніч
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
