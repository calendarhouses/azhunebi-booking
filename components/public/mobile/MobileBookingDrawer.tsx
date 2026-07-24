"use client";

import { useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import type { PublicRoom } from "@/lib/public-booking/types";
import { PublicAmenitiesSection } from "../PublicAmenitiesSection";
import { PublicDiscountsSection } from "../PublicDiscountsSection";
import { DrawerContent } from "../DrawerContent";
import { DrawerRoomHeader } from "../DrawerRoomHeader";
import { DesktopIcons } from "@/lib/public-booking/desktopIcons";
import { PublicRoomRulesSection } from "../PublicRoomRulesSection";
import { BrandingMapSection } from "../BrandingMapSection";
import { formatPriceUa, getRoomImages, getRoomMinPrice } from "@/lib/public-booking/roomHelpers";
import { useSliderTrackStyle } from "@/lib/public-booking/useSliderTrackStyle";
import { CabinSlideImage } from "../CabinSlideImage";
import { usePublicBooking } from "../PublicBookingProvider";
import { BookingCheckoutSummary } from "../desktop/BookingCheckoutSummary";
import { BookingFlexConflictAlert } from "../BookingFlexConflictAlert";
import { BookingStayRules } from "../BookingStayRules";
import { BookingPromoCodeField } from "@/components/admin/desktop/BookingPromoCodeField";
import { DesktopCalendar } from "../desktop/DesktopCalendar";
import { PublicGuestsAndServicesBlock } from "../PublicGuestsAndServicesBlock";
import { showPublicToast } from "@/lib/public-booking/publicToast";
import { normalizeUaNationalPhoneDigits } from "@/lib/public-booking/uaPhone";

function formatFlexFeeLabel(amount: number, requiresApproval: boolean, selected: boolean): string {
  if (!selected) return requiresApproval ? "За запитом" : `${amount.toLocaleString("uk-UA")} ₴`;
  if (requiresApproval) return `Запит · від ${amount.toLocaleString("uk-UA")} ₴`;
  return `+${amount.toLocaleString("uk-UA")} ₴`;
}

export function MobileBookingDrawer() {
  const {
    runtime,
    drawerOpen: open,
    drawerStep: step,
    drawerScrollKey,
    selectedRoom: room,
    closeDrawer: onClose,
    goDrawerStep: setStep,
    detailSlide,
    slideDetail,
    guestCount,
    changeGuests,
    childCount,
    changeChildren,
    youngestChildAge,
    changeYoungestChildAge,
    availableServices,
    selectedServices,
    setServiceQty,
    showChildren,
    childrenPolicyMessage,
    childrenPolicyBlocked,
    flexibleSchedule,
    hasUbd,
    setHasUbd,
    showUbd,
    ubdTariffLabel,
    ubdTariffHint,
    showPromoCode,
    promoCode,
    setPromoCode,
    promoCodeStatus,
    earlyActive,
    lateActive,
    earlyTime,
    lateTime,
    toggleService,
    selectTime,
    proceedDisabled,
    proceedLabel,
    price,
    priceError,
    postLateGapNotice,
    postLateArrivalTime,
    isPostLateGapStay,
    checkIn,
    checkOut,
    submitCheckout,
    submitting,
    getNextFreeForRoom,
  } = usePublicBooking();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const detailSliderRef = useRef<HTMLDivElement>(null);
  const detailSliderTrackStyle = useSliderTrackStyle(detailSliderRef, detailSlide);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

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
  const images = getRoomImages(roomAsPublic, { card: true });
  const minPrice = getRoomMinPrice(roomAsPublic, runtime?.customPrices || {});
  const branding = runtime?.branding || {};
  const nextFree = runtime ? getNextFreeForRoom(roomAsPublic) : "—";
  const maxGuests = room.maxCapacity || room.capacity;

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
          <DrawerContent scrollResetKey={`${drawerScrollKey}-info`}>
            <div
              className="detail-slider-wrap"
              id="detailSlider"
              ref={detailSliderRef}
              onTouchStart={onDetailTouchStart}
              onTouchEnd={onDetailTouchEnd}
            >
              <div className="slider-track" id="track-detail" style={detailSliderTrackStyle}>
                {images.map((url, i) => (
                  <div className="slide" key={i}>
                    <CabinSlideImage src={url} alt={room.name} loading={i === 0 ? "eager" : "lazy"} />
                  </div>
                ))}
              </div>
            </div>

            <DrawerRoomHeader room={roomAsPublic} nextFreeLabel={nextFree} />

            <PublicAmenitiesSection room={roomAsPublic} resetKey={roomAsPublic.id} />

            <PublicDiscountsSection
              roomId={room.id}
              discounts={runtime?.discounts || []}
              resetKey={roomAsPublic.id}
            />

            <PublicRoomRulesSection room={roomAsPublic} />

            <BrandingMapSection branding={branding} lazyMount />
          </DrawerContent>

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
          <DrawerContent scrollResetKey={`${drawerScrollKey}-calendar`}>
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

            {checkIn && checkOut && postLateGapNotice ? (
              <div className="booking-gap-notice">
                <BookingFlexConflictAlert message={postLateGapNotice} />
              </div>
            ) : null}

            <div className="guests-block">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Гості</h3>
              <PublicGuestsAndServicesBlock
                adults={guestCount}
                children={childCount}
                youngestChildAge={youngestChildAge}
                maxOccupants={maxGuests}
                showChildren={showChildren}
                childrenPolicyMessage={childrenPolicyMessage}
                availableServices={availableServices}
                selectedServices={selectedServices}
                onChangeAdults={changeGuests}
                onChangeChildren={changeChildren}
                onChangeYoungestChildAge={changeYoungestChildAge}
                onSetServiceQty={setServiceQty}
              />

              {showUbd ? (
                <div
                  id="ubdContainer"
                  className="guests-row"
                  style={{ marginTop: 8, borderTop: "1px dashed var(--border)", paddingTop: 16 }}
                >
                  <div>
                    <div className="guests-label">{ubdTariffLabel}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {ubdTariffHint}
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
            </div>

            <div className="guests-block" style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Гнучкий графік</h3>
              {isPostLateGapStay && postLateArrivalTime ? (
                <>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                    Заїзд зафіксовано з <b>{postLateArrivalTime}</b> (після виїзду попереднього гостя).
                    Ранній заїзд / пізній виїзд для цих дат недоступні.
                  </p>
                  <BookingFlexConflictAlert message={priceError} />
                </>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
                    Стандартний заїзд з {flexibleSchedule.standardCheckIn}, виїзд до{" "}
                    {flexibleSchedule.standardCheckOut}
                  </p>
                  <ServiceCard
                    id="cardEarly"
                    title="Ранній заїзд"
                    active={earlyActive}
                    priceLabel={formatFlexFeeLabel(
                      flexibleSchedule.earlyFee,
                      flexibleSchedule.requiresApproval,
                      !!earlyTime
                    )}
                    onToggle={() => toggleService("early")}
                  >
                    <TimeChips
                      times={flexibleSchedule.earlyTimes}
                      selected={earlyTime}
                      onSelect={(t) => selectTime("early", t)}
                    />
                  </ServiceCard>
                  <ServiceCard
                    id="cardLate"
                    title="Пізній виїзд"
                    active={lateActive}
                    priceLabel={formatFlexFeeLabel(
                      flexibleSchedule.lateFee,
                      flexibleSchedule.requiresApproval,
                      !!lateTime
                    )}
                    onToggle={() => toggleService("late")}
                    lateIcon
                  >
                    <TimeChips
                      times={flexibleSchedule.lateTimes}
                      selected={lateTime}
                      onSelect={(t) => selectTime("late", t)}
                    />
                  </ServiceCard>
                  <BookingFlexConflictAlert message={priceError} />
                </>
              )}
            </div>
          </DrawerContent>

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
          <DrawerContent scrollResetKey={`${drawerScrollKey}-checkout`}>
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
              {showPromoCode ? (
                <BookingPromoCodeField
                  variant="public"
                  value={promoCode}
                  onChange={setPromoCode}
                  status={promoCodeStatus}
                />
              ) : null}
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
          </DrawerContent>

          <div className="sticky-cta">
            <button
              type="button"
              className="btn-proceed"
              id="bookBtn"
              disabled={submitting || !price || childrenPolicyBlocked}
              onClick={() => {
                if (!firstName.trim()) {
                  showPublicToast("Введіть ваше ім'я");
                  return;
                }
                if (!phone.trim() || normalizeUaNationalPhoneDigits(phone).length < 9) {
                  showPublicToast("Введіть коректний номер телефону");
                  return;
                }
                setStep("rules");
              }}
            >
              Забронювати
            </button>
          </div>
        </div>

        <div
          id="drawer-step-rules"
          className={`drawer-step ${step === "rules" ? "active" : ""}`}
        >
          <DrawerContent scrollResetKey={`${drawerScrollKey}-rules`}>
            <button
              type="button"
              className="back-btn"
              onClick={() => setStep("checkout")}
              disabled={submitting}
            >
              <svg viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>{" "}
              До даних гостя
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
                <div className="step-num">4</div>
                <div className="step-label">Правила</div>
              </div>
            </div>

            <BookingStayRules />
          </DrawerContent>

          <div className="sticky-cta sticky-cta--rules">
            <button
              type="button"
              className="btn-proceed"
              id="agreeRulesBtn"
              disabled={submitting || !price || childrenPolicyBlocked}
              onClick={() =>
                submitCheckout({ firstName, lastName, phone, comment })
              }
            >
              {submitting ? "Відправляємо..." : "Погоджуюсь"}
            </button>
            <button
              type="button"
              className="btn-rules-back"
              disabled={submitting}
              onClick={() => setStep("checkout")}
            >
              Повернутися
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
