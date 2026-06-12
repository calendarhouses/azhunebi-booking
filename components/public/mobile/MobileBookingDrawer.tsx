"use client";

import { useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import type { PublicRoom } from "@/lib/public-booking/types";
import {
  getRoomAmenities,
  getRoomDescription,
  getRoomDiscounts,
} from "@/lib/public-booking/desktopRoomContent";
import { DesktopIcons } from "@/lib/public-booking/desktopIcons";
import { formatPriceUa, getRoomImages, getRoomMinPrice } from "@/lib/public-booking/roomHelpers";
import { usePublicBooking } from "../PublicBookingProvider";
import { BookingCheckoutSummary } from "../desktop/BookingCheckoutSummary";
import { DesktopCalendar } from "../desktop/DesktopCalendar";

const DEFAULT_MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2555.1302878618076!2d30.221603476541116!3d50.17740027154132!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x40d4af1506961329%3A0xf65baf00b5986843!2sBOSO%20Houses!5e0!3m2!1suk!2sua!4v1777888609095!5m2!1suk!2sua";
const DEFAULT_MAP_LINK = "https://maps.app.goo.gl/qi22qhUQdB223LJy7";

const EARLY_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"];
const LATE_TIMES = [
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00",
];

export function MobileBookingDrawer() {
  const {
    runtime,
    drawerOpen: open,
    drawerStep: step,
    selectedRoom: room,
    closeDrawer: onClose,
    goDrawerStep: setStep,
    detailSlide,
    slideDetail,
    guestCount,
    changeGuests,
    dayGuests,
    changeDayGuests,
    hasPets,
    setHasPets,
    hasVat,
    setHasVat,
    hasUbd,
    setHasUbd,
    showVat,
    showUbd,
    earlyActive,
    lateActive,
    earlyTime,
    lateTime,
    toggleService,
    selectTime,
    proceedDisabled,
    proceedLabel,
    price,
    checkIn,
    checkOut,
    submitCheckout,
    submitting,
  } = usePublicBooking();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");

  if (!room) {
    return (
      <div
        id="screen-detail"
        className={`drawer-overlay ${open ? "open" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      />
    );
  }

  const roomAsPublic = room as PublicRoom;
  const images = getRoomImages(roomAsPublic);
  const minPrice = getRoomMinPrice(roomAsPublic, runtime?.customPrices || {});
  const amenities = getRoomAmenities(roomAsPublic);
  const roomDiscounts = getRoomDiscounts(room.id, runtime?.discounts || []);
  const branding = runtime?.branding || {};
  const mapEmbed = (branding.maps_embed_url as string) || DEFAULT_MAP_EMBED;
  const mapLink = (branding.maps_external_url as string) || DEFAULT_MAP_LINK;
  const maxGuests = room.maxCapacity || room.capacity;

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const onDetailTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };

  const onDetailTouchEnd = (e: TouchEvent) => {
    if (images.length <= 1) return;
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) slideDetail(diff > 0 ? 1 : -1);
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const overlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      id="screen-detail"
      className={`drawer-overlay ${open ? "open" : ""}`}
      onClick={overlayClick}
    >
      <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <button type="button" className="drawer-close-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div
          id="drawer-step-info"
          className={`drawer-step ${step === "info" ? "active" : ""}`}
        >
          <div className="drawer-content">
            <div
              className="detail-slider-wrap"
              id="detailSlider"
              onTouchStart={onDetailTouchStart}
              onTouchEnd={onDetailTouchEnd}
            >
              <div
                className="slider-track"
                id="track-detail"
                style={{
                  display: "flex",
                  height: "100%",
                  transition: "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
                  transform: `translateX(-${detailSlide * 100}%)`,
                }}
              >
                {images.map((url, i) => (
                  <div
                    className="slide"
                    key={i}
                    style={{ minWidth: "100%", height: "100%" }}
                  >
                    <img
                      src={url}
                      alt={room.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <h2 className="detail-title" id="detailTitle">
              {room.name}
            </h2>

            <h3 className="section-title">Про котедж</h3>
            <p
              id="detailDesc"
              style={{
                fontSize: 14,
                color: "#4B5563",
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              {getRoomDescription(room)}
            </p>

            <div className="divider" />
            <h3 className="section-title">Що включено</h3>
            <div className="amenities-grid" id="amenitiesList">
              {amenities.map((a, i) => (
                <div key={i} className="amenity-item">
                  {a.icon} {a.label}
                </div>
              ))}
            </div>

            <div className="divider" />
            <h3 className="section-title">Знижки за тривалість</h3>
            <div id="detailDiscounts" className="discounts-grid">
              {roomDiscounts.map((d) => {
                const nightsMatch = d.condition.match(/\d+/);
                const nightsText = nightsMatch
                  ? `Від ${nightsMatch[0]} ночей`
                  : d.condition;
                return (
                  <div key={d.id} className="discount-card">
                    <div className="cond">
                      {DesktopIcons.moon}
                      <span>{nightsText}</span>
                    </div>
                    <div className="pct">-{d.discount}</div>
                  </div>
                );
              })}
            </div>

            <div className="divider" />
            <h3 className="section-title">Правила</h3>
            <div className="rules-grid">
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="1.5" />
                    <path d="M12 6v6l4 2" stroke="currentColor" fill="none" strokeWidth="1.5" />
                  </svg>
                }
                label="Заселення"
                text="15:00 – 23:00"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                  </svg>
                }
                label="Виселення"
                text="до 11:00"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M12 12c-2 0-4 1.5-4 4s2 6 4 6 4-3.5 4-6-2-4-4-4z"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                  </svg>
                }
                label="Тварина"
                text="За узгодженням"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M18 20V10M12 20V4M6 20v-6M4 22h16"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                  </svg>
                }
                label="Куріння"
                text="Лише на вулиці"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                  </svg>
                }
                label="Режим тиші"
                text="22:00 – 08:00"
              />
            </div>

            <div className="divider" />
            <h3 className="section-title">ВІДМІНА БРОНЮВАННЯ</h3>
            <div className="rules-grid" style={{ gridTemplateColumns: "1fr", gap: 12 }}>
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                    <path d="M12 8v4l3 3" stroke="currentColor" fill="none" strokeWidth="1.5" />
                  </svg>
                }
                label="За 30-14 днів"
                text="Повертаємо 80% передоплати або безкоштовно переносимо дати відпочинку"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                    <path d="M21 3v5h-5" stroke="currentColor" fill="none" strokeWidth="1.5" />
                  </svg>
                }
                label="За 13-7 днів"
                text="Повертаємо 50% від внесеної передоплати"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" fill="none" strokeWidth="1.5" />
                    <path d="M12 14v4M10 16h4" stroke="currentColor" fill="none" strokeWidth="1.5" />
                  </svg>
                }
                label="За 6 днів"
                text="Сума передоплати зберігається як депозит, що діє протягом 3 місяців"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="1.5" />
                    <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                }
                label="Менше ніж за 72 години"
                text="Передоплата не повертається та не переноситься"
              />
            </div>

            <div className="divider" />
            <h3 className="section-title">Безпека на території</h3>
            <div className="rules-grid" style={{ marginBottom: 40 }}>
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="1.5"
                    />
                    <circle cx="12" cy="13" r="4" stroke="currentColor" fill="none" strokeWidth="1.5" />
                  </svg>
                }
                text="Камери на території"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path d="M7 21h10M9 21V7a3 3 0 0 1 6 0v14" stroke="currentColor" fill="none" strokeWidth="1.5" />
                  </svg>
                }
                text="Є вогнегасник"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" fill="none" strokeWidth="1.5" />
                    <path d="M12 8v8M8 12h8" stroke="currentColor" fill="none" strokeWidth="1.5" />
                  </svg>
                }
                text="Є аптечка"
              />
              <RuleCard
                icon={
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" fill="none" strokeWidth="1.5" />
                  </svg>
                }
                text="Датчик диму"
              />
            </div>

            <div className="divider" />
            <h3 className="section-title">Ви відпочиватимете тут</h3>
            <div className="map-wrapper">
              <iframe
                src={mapEmbed}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Карта"
              />
            </div>
            <a href={mapLink} target="_blank" rel="noreferrer" className="map-external-link">
              ПРОКЛАСТИ МАРШРУТ
              <svg viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                />
              </svg>
            </a>
          </div>

          <div className="sticky-cta">
            <div className="sticky-price">
              від <strong id="ctaPrice">{formatPriceUa(minPrice)}</strong> грн/ніч
            </div>
            <button
              type="button"
              className="btn-proceed"
              style={{ width: "auto", padding: "14px 28px" }}
              onClick={() => setStep("calendar")}
            >
              Дати
            </button>
          </div>
        </div>

        <div
          id="drawer-step-calendar"
          className={`drawer-step ${step === "calendar" ? "active" : ""}`}
        >
          <div className="drawer-content">
            <button type="button" className="back-btn" onClick={() => setStep("info")}>
              <svg viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>{" "}
              Інфо
            </button>

            <div className="step-bar">
              <div className="step done">
                <div className="step-num">✓</div>
                <div className="step-label">Котедж</div>
              </div>
              <div className="step-line done" />
              <div className="step active">
                <div className="step-num">2</div>
                <div className="step-label">Дати</div>
              </div>
              <div className="step-line" />
              <div className="step">
                <div className="step-num">3</div>
                <div className="step-label">Бронь</div>
              </div>
            </div>

            <DesktopCalendar room={room} layout="mobile" />

            <div className="guests-block">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Гості</h3>
              <div className="guests-row">
                <div>
                  <div className="guests-label">Дорослі</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>З ночівлею</div>
                </div>
                <div className="counter-wrap">
                  <button
                    type="button"
                    className="cnt-btn"
                    disabled={guestCount <= 1}
                    onClick={() => changeGuests(-1)}
                  >
                    −
                  </button>
                  <span className="cnt-val" id="guestCount">
                    {guestCount}
                  </span>
                  <button
                    type="button"
                    className="cnt-btn"
                    disabled={guestCount >= maxGuests}
                    onClick={() => changeGuests(1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div
                className="guests-row"
                style={{ marginTop: 8, borderTop: "1px dashed var(--border)", paddingTop: 16 }}
              >
                <div>
                  <div className="guests-label">Денні гості</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    Без ночівлі (+500 грн, 10:00 - 21:00)
                  </div>
                </div>
                <div className="counter-wrap">
                  <button
                    type="button"
                    className="cnt-btn"
                    disabled={dayGuests <= 0}
                    onClick={() => changeDayGuests(-1)}
                  >
                    −
                  </button>
                  <span className="cnt-val" id="dayGuestCount">
                    {dayGuests}
                  </span>
                  <button type="button" className="cnt-btn" onClick={() => changeDayGuests(1)}>
                    +
                  </button>
                </div>
              </div>

              {showVat ? (
                <div
                  id="vatContainer"
                  className="guests-row"
                  style={{ marginTop: 8, borderTop: "1px dashed var(--border)", paddingTop: 16 }}
                >
                  <div>
                    <div className="guests-label">Чан</div>
                    <div className="guests-sub" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Оплата на місці
                    </div>
                  </div>
                  <div
                    className="pets-toggle"
                    style={{ marginTop: 0, paddingTop: 0, border: "none", flex: "0 0 auto", width: 140 }}
                  >
                    <button
                      type="button"
                      className={`pet-opt ${!hasVat ? "active" : ""}`}
                      style={{ padding: 8 }}
                      onClick={() => setHasVat(false)}
                    >
                      Ні
                    </button>
                    <button
                      type="button"
                      className={`pet-opt ${hasVat ? "active" : ""}`}
                      style={{ padding: 8 }}
                      onClick={() => setHasVat(true)}
                    >
                      Так
                    </button>
                  </div>
                </div>
              ) : null}

              {showUbd ? (
                <div
                  id="ubdContainer"
                  className="guests-row"
                  style={{ marginTop: 8, borderTop: "1px dashed var(--border)", paddingTop: 16 }}
                >
                  <div>
                    <div className="guests-label">Знижка УБД</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      -10% (потрібне посвідчення)
                    </div>
                  </div>
                  <div
                    className="pets-toggle"
                    style={{ marginTop: 0, paddingTop: 0, border: "none", flex: "0 0 auto", width: 140 }}
                  >
                    <button
                      type="button"
                      className={`pet-opt ${!hasUbd ? "active" : ""}`}
                      style={{ padding: 8 }}
                      onClick={() => setHasUbd(false)}
                    >
                      Ні
                    </button>
                    <button
                      type="button"
                      className={`pet-opt ${hasUbd ? "active" : ""}`}
                      style={{ padding: 8 }}
                      onClick={() => setHasUbd(true)}
                    >
                      Так
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="pets-toggle">
                <button
                  type="button"
                  className={`pet-opt ${!hasPets ? "active" : ""}`}
                  onClick={() => setHasPets(false)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                  Без тварини
                </button>
                <button
                  type="button"
                  className={`pet-opt ${hasPets ? "active" : ""}`}
                  onClick={() => setHasPets(true)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm-6.5 3c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm13 0c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3zm-6.5 5.5c-3.1 0-5.8 2.4-6.4 5.5-.1.6.1 1.2.6 1.7.7.7 1.8.7 2.5.2.5-.4 1.1-.7 1.8-.7 1.1 0 2.2.5 2.8 1.4.4.5 1.1.5 1.5 0 .6-.9 1.7-1.4 2.8-1.4.7 0 1.4.3 1.8.7.7.5 1.8.5 2.5-.2.5-.5.7-1.1.6-1.7-.6-3.1-3.3-5.5-6.4-5.5z" />
                  </svg>
                  З твариною
                </button>
              </div>
            </div>

            <div className="guests-block" style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Гнучкий графік</h3>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
                  Стандартний заїзд з 15:00, виїзд до 11:00
                </p>
                <ServiceCard
                  id="cardEarly"
                  title="Ранній заїзд"
                  active={earlyActive}
                  priceLabel={earlyTime ? "+500 грн" : "+500 грн"}
                  onToggle={() => toggleService("early")}
                >
                  <TimeChips
                    times={EARLY_TIMES}
                    selected={earlyTime}
                    onSelect={(t) => selectTime("early", t)}
                  />
                </ServiceCard>
                <ServiceCard
                  id="cardLate"
                  title="Пізній виїзд"
                  active={lateActive}
                  priceLabel={lateTime ? "+500 грн" : "+500 грн"}
                  onToggle={() => toggleService("late")}
                  lateIcon
                >
                  <TimeChips
                    times={LATE_TIMES}
                    selected={lateTime}
                    onSelect={(t) => selectTime("late", t)}
                  />
                </ServiceCard>
              </div>
          </div>

          <div className="sticky-cta">
            <button
              type="button"
              className="btn-proceed"
              id="proceedBtn"
              disabled={proceedDisabled}
              onClick={() => !proceedDisabled && setStep("checkout")}
            >
              {proceedLabel}
            </button>
          </div>
        </div>

        <div
          id="drawer-step-checkout"
          className={`drawer-step ${step === "checkout" ? "active" : ""}`}
        >
          <div className="drawer-content">
            <button type="button" className="back-btn" onClick={() => setStep("calendar")}>
              <svg viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>{" "}
              Змінити дати
            </button>

            <div className="step-bar">
              <div className="step done">
                <div className="step-num">✓</div>
                <div className="step-label">Котедж</div>
              </div>
              <div className="step-line done" />
              <div className="step done">
                <div className="step-num">✓</div>
                <div className="step-label">Дати</div>
              </div>
              <div className="step-line done" />
              <div className="step active">
                <div className="step-num">3</div>
                <div className="step-label">Бронь</div>
              </div>
            </div>

            {price && checkIn && checkOut ? (
              <BookingCheckoutSummary price={price} checkIn={checkIn} checkOut={checkOut} />
            ) : null}

            <div className="form-block">
              <h3
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 24,
                  fontWeight: 700,
                  marginBottom: 24,
                  letterSpacing: "-0.5px",
                  color: "var(--text)",
                }}
              >
                Ваші дані
              </h3>
              <div className="form-grid2">
                <div className="form-field">
                  <label>
                    Ім&apos;я <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="fFirstName"
                    placeholder="Іван"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label>Прізвище</label>
                  <input
                    type="text"
                    id="fLastName"
                    placeholder="Петренко"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-field">
                <label>
                  Телефон <span className="required">*</span>
                </label>
                <div className="phone-wrap">
                  <div className="phone-prefix">🇺🇦 +380</div>
                  <input
                    type="tel"
                    id="fPhone"
                    placeholder="XX XXX XXXX"
                    style={{ flex: 1 }}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-field">
                <label>Коментар</label>
                <textarea
                  id="fComment"
                  placeholder="Будь-який коментар або побажання..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="sticky-cta">
            <button
              type="button"
              className="btn-proceed"
              id="bookBtn"
              disabled={submitting || !price}
              onClick={() =>
                submitCheckout({ firstName, lastName, phone, comment })
              }
            >
              {submitting ? "Відправляємо..." : "Забронювати"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  id,
  title,
  active,
  priceLabel,
  onToggle,
  lateIcon,
  children,
}: {
  id?: string;
  title: string;
  active: boolean;
  priceLabel: string;
  onToggle: () => void;
  lateIcon?: boolean;
  children: ReactNode;
}) {
  return (
    <div id={id} className={`service-card ${active ? "active" : ""}`}>
      <button
        type="button"
        className="srv-header"
        onClick={onToggle}
        style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
      >
        <div className="srv-title">
          <svg viewBox="0 0 24 24">
            {lateIcon ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M12 7v5l2.5 2.5"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            )}
          </svg>
          {title}
        </div>
        <div className="srv-price" id={id === "cardEarly" ? "labelPriceEarly" : id === "cardLate" ? "labelPriceLate" : undefined}>
          {priceLabel}
        </div>
      </button>
      {active ? <div className="srv-body">{children}</div> : null}
    </div>
  );
}

function TimeChips({
  times,
  selected,
  onSelect,
}: {
  times: string[];
  selected: string | null;
  onSelect: (t: string) => void;
}) {
  return (
    <div className="time-chips">
      {times.map((t) => (
        <button
          key={t}
          type="button"
          className={`t-chip ${selected === t ? "selected" : ""}`}
          onClick={() => onSelect(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function RuleCard({
  icon,
  label,
  text,
}: {
  icon: ReactNode;
  label?: string;
  text: string;
}) {
  return (
    <div className="rule-card">
      {icon}
      <div>
        {label ? <span>{label}</span> : null}
        {text}
      </div>
    </div>
  );
}
