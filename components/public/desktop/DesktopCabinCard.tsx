"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicRoom } from "@/lib/public-booking/types";
import { buildPublicAmenities, getRoomDescription } from "@/lib/public-booking/desktopRoomContent";
import { DesktopIcons } from "@/lib/public-booking/desktopIcons";
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

export function DesktopCabinCard({ room, customPrices, nextFreeLabel, onBook }: Props) {
  const images = getRoomImages(room);
  const minPrice = getRoomMinPrice(room, customPrices);
  const [slideIndex, setSlideIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const { featured, byCategory } = buildPublicAmenities(room);

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
        role="button"
        tabIndex={0}
        onClick={onBook}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onBook();
        }}
      >
        <div className="cabin-badge">{room.desc}</div>
        <div
          className="slider-track"
          style={{ transform: `translateX(-${slideIndex * 100}%)` }}
        >
          {images.map((url, i) => (
            <div className="slide" key={i}>
              <img
                src={url}
                alt={room.name}
                loading="lazy"
                onError={(e) => {
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML =
                      '<div class="slide-placeholder">🏡</div>';
                  }
                }}
              />
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
        <div className="cabin-subtitle">{getRoomSubtitle(room)}</div>

        <div className="premium-features">
          {featured.map((item, idx) => (
            <div key={idx} className="feature-item">
              <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {item.icon}
                <span>{item.label}</span>
              </strong>
            </div>
          ))}
        </div>

        <p
          style={{
            fontSize: 14,
            color: "#4B5563",
            lineHeight: 1.6,
            marginBottom: 16,
            maxHeight: 80,
            overflow: "hidden",
          }}
        >
          {getRoomDescription(room)}
        </p>

        <div className="cabin-meta">
          <div className="cabin-meta-item">
            {DesktopIcons.guests}
            До {room.maxCapacity || room.capacity} гостей
          </div>
          <div className="cabin-meta-item">
            {DesktopIcons.calendar}
            Вільний: <span className="cabin-next-free">{nextFreeLabel}</span>
          </div>
        </div>

        {room.rules ? (
          <div
            className="cabin-meta"
            style={{
              marginTop: 8,
              fontSize: 12,
              color: "#4B5563",
              background: "#F9FAFB",
              borderRadius: 12,
              padding: 12,
              border: "1px solid #E5E7EB",
            }}
          >
            <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
              <span>
                <strong>Заїзд:</strong> {room.rules.checkInTime || "15:00"}
              </span>
              <span>
                <strong>Виїзд:</strong> {room.rules.checkOutTime || "11:00"}
              </span>
            </div>
            <div style={{ marginBottom: 4 }}>
              <strong>Тварини:</strong>{" "}
              {room.rules.pets?.isPetsFriendly ? "дозволені" : "не дозволені"}
              {room.rules.pets?.description
                ? ` · ${room.rules.pets.description}`
                : null}
            </div>
            {room.rules.selfCheckIn?.enabled ? (
              <div>
                <strong>Самостійне заселення:</strong>{" "}
                {room.rules.selfCheckIn.description || "є інструкція для гостя"}
              </div>
            ) : null}
          </div>
        ) : null}

        {byCategory.length ? (
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {byCategory.map((cat) => (
              <div
                key={cat.id}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px dashed #E5E7EB",
                  background: "#FFFFFF",
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#9CA3AF",
                    marginBottom: 6,
                  }}
                >
                  {cat.title}
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc" }}>
                  {cat.items.map((a, idx) => (
                    <li key={idx} style={{ marginBottom: 2 }}>
                      {a.label}
                    </li>
                  ))}
                </ul>
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
