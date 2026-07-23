"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { MobileSheetHeader } from "../mobile/MobileSheetHeader";
import { useMobileUi } from "../mobile/MobileUiContext";
import { BookingPriceCalculator } from "./BookingPriceCalculator";
import { BookingGuestsAndServicesFields } from "./BookingGuestsAndServicesFields";
import { BookingSpecialTariffsFields } from "./BookingSpecialTariffsFields";
import { BookingPromoCodeField } from "./BookingPromoCodeField";
import { BookingFormSectionHeading } from "./BookingFormSectionHeading";
import { BookingColorPicker } from "./BookingColorPicker";
import { BookingStayRangeCalendar } from "./BookingStayRangeCalendar";
import { BookingNightlyBreakdown, buildNightlyPriceLines } from "./BookingNightlyBreakdown";
import {
  applyNightlyPriceOverrides,
  hasNightlyPriceOverrides,
  sumNightlyPrices,
  type NightlyPriceOverrides,
} from "@/lib/admin/bookingNightlyPrices";
import { hasActivePromoCodeDiscounts, promoCodeAppliesToBooking } from "@/lib/admin/bookingDiscountCalc";
import { isPendingReviewStatus } from "@/lib/public-booking/bookingReview";
import { bookingAccentTintStyle } from "@/lib/bookingCustomColor";
import { findBookingInList, findRoomForBooking, resolveBookingAccentColor, resolveBookingOrderId } from "./bookingUtils";
import { ADMIN_SELECTABLE_SOURCES } from "./adminUiHelpers";
import {
  BookingReviewActions,
  BOOKING_STATUS_AWAITING_PAYMENT,
} from "../shared/BookingReviewActions";
import type { useBookingDrawer } from "./useBookingDrawer";
import type { AdminSettingsPayload, BookingRecord, RoomConfig } from "./types";

type DrawerApi = ReturnType<typeof useBookingDrawer>;

/* eslint-disable @typescript-eslint/no-explicit-any */
function w(): any {
  return typeof window !== "undefined" ? window : {};
}

export interface DesktopBookingDrawerProps {
  roomsList?: RoomConfig[];
  drawer: DrawerApi;
  settings: AdminSettingsPayload;
  bookings: BookingRecord[];
  onBookingReviewed?: () => void | Promise<void>;
}

export function DesktopBookingDrawer({
  roomsList: _roomsList,
  drawer,
  settings,
  bookings,
  onBookingReviewed,
}: DesktopBookingDrawerProps) {
  void _roomsList;
  const { form, editingBookingId, editingRow, drawerTitle } = drawer;
  const isMobile = useMobileUi();
  const activeBooking = useMemo(
    () => findBookingInList(bookings, editingBookingId || editingRow),
    [bookings, editingBookingId, editingRow]
  );
  const reviewOrderId = resolveBookingOrderId(activeBooking, drawerTitle);
  const showReviewActions = Boolean(
    reviewOrderId && isPendingReviewStatus(activeBooking?.status ?? form.status)
  );
  const resolvedRoomForPromo = useMemo(
    () =>
      findRoomForBooking(
        { cottage: form.cottage, roomId: form.roomId ?? undefined },
        settings.roomsList || []
      ),
    [form.cottage, form.roomId, settings.roomsList]
  );
  const roomId =
    form.roomId != null
      ? String(form.roomId)
      : resolvedRoomForPromo?.id != null
        ? String(resolvedRoomForPromo.id)
        : undefined;
  const showPromoCode = hasActivePromoCodeDiscounts(settings.discountsList, roomId);
  const promoStatus =
    !form.promoCode.trim() || !showPromoCode
      ? "idle"
      : promoCodeAppliesToBooking(form.promoCode, settings.discountsList || [], {
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          nights: 0,
          roomId: roomId || "",
          enabledSpecialTariffIds: [],
        })
        ? "valid"
        : "invalid";
  const accentColor = useMemo(
    () =>
      resolveBookingAccentColor(activeBooking, {
        customColor: form.customColor,
        status: form.status,
      }),
    [activeBooking, form.customColor, form.status]
  );
  const drawerTintStyle = useMemo(() => bookingAccentTintStyle(accentColor), [accentColor]);
  const selectedRoom = useMemo(() => {
    if (!form.cottage || form.cottage === "Нерозподілені") return null;
    return resolvedRoomForPromo || null;
  }, [form.cottage, resolvedRoomForPromo]);

  const [nightlyPriceOverrides, setNightlyPriceOverrides] = useState<NightlyPriceOverrides>({});

  const defaultNightlyLines = useMemo(
    () => buildNightlyPriceLines(form.checkIn, form.checkOut, selectedRoom, settings.customPrices),
    [form.checkIn, form.checkOut, selectedRoom, settings.customPrices]
  );

  const effectiveNightlyLines = useMemo(
    () => applyNightlyPriceOverrides(defaultNightlyLines, nightlyPriceOverrides),
    [defaultNightlyLines, nightlyPriceOverrides]
  );

  const nightlyBaseSum = useMemo(
    () => sumNightlyPrices(effectiveNightlyLines),
    [effectiveNightlyLines]
  );

  const nightlyOverridesActive = hasNightlyPriceOverrides(nightlyPriceOverrides);
  const [instantDiscountAmount, setInstantDiscountAmount] = useState(0);
  const [instantDiscountPercent, setInstantDiscountPercent] = useState(0);
  const [instantDiscountMode, setInstantDiscountMode] = useState<"amount" | "percent">("amount");

  useEffect(() => {
    setNightlyPriceOverrides({});
  }, [form.checkIn, form.checkOut, form.cottage, form.roomId]);

  useEffect(() => {
    setNightlyPriceOverrides({});
  }, [editingRow, editingBookingId]);

  // Reset instant discount when switching bookings (layout: before child hydrate effects).
  useLayoutEffect(() => {
    setInstantDiscountAmount(0);
    setInstantDiscountPercent(0);
    setInstantDiscountMode("amount");
  }, [editingRow, editingBookingId]);

  const hydrateInstantDiscount = useCallback(
    (amount: number) => {
      const rounded = Math.max(0, Math.round(amount));
      const clamped =
        nightlyBaseSum > 0 ? Math.min(rounded, nightlyBaseSum) : rounded;
      setInstantDiscountMode("amount");
      setInstantDiscountAmount(clamped);
      setInstantDiscountPercent(
        nightlyBaseSum > 0 ? Math.round((clamped / nightlyBaseSum) * 100) : 0
      );
    },
    [nightlyBaseSum]
  );

  const handleNightlyPriceChange = useCallback((dateKey: string, price: number) => {
    setNightlyPriceOverrides((prev) => ({
      ...prev,
      [dateKey]: Math.max(0, Math.round(price)),
    }));
  }, []);

  const clearNightlyPriceOverrides = useCallback(() => {
    setNightlyPriceOverrides({});
  }, []);

  const handleInstantDiscountAmountChange = useCallback(
    (value: number) => {
      const clamped = Math.min(Math.max(0, Math.round(value)), nightlyBaseSum);
      setInstantDiscountMode("amount");
      setInstantDiscountAmount(clamped);
      setInstantDiscountPercent(nightlyBaseSum > 0 ? Math.round((clamped / nightlyBaseSum) * 100) : 0);
    },
    [nightlyBaseSum]
  );

  const handleInstantDiscountPercentChange = useCallback(
    (value: number) => {
      const clampedPercent = Math.min(100, Math.max(0, Math.round(value)));
      setInstantDiscountMode("percent");
      setInstantDiscountPercent(clampedPercent);
      setInstantDiscountAmount(Math.min(nightlyBaseSum, Math.round((nightlyBaseSum * clampedPercent) / 100)));
    },
    [nightlyBaseSum]
  );

  useEffect(() => {
    if (instantDiscountMode === "percent") {
      setInstantDiscountAmount(Math.min(nightlyBaseSum, Math.round((nightlyBaseSum * instantDiscountPercent) / 100)));
      return;
    }
    const clamped = Math.min(Math.max(0, Math.round(instantDiscountAmount)), nightlyBaseSum);
    if (clamped !== instantDiscountAmount) {
      setInstantDiscountAmount(clamped);
    }
    setInstantDiscountPercent(nightlyBaseSum > 0 ? Math.round((clamped / nightlyBaseSum) * 100) : 0);
  }, [nightlyBaseSum, instantDiscountAmount, instantDiscountPercent, instantDiscountMode]);

  return (
    <div id="bookingDrawer" className="drawer-overlay">
      <div className="drawer drawer--booking-tint" style={drawerTintStyle}>
        {isMobile ? (
          <MobileSheetHeader title={<span id="drawerTitle">{drawer.drawerTitle}</span>} onClose={() => drawer.closeDrawer()} />
        ) : (
          <div className="drawer-header">
            <h2 id="drawerTitle">{drawer.drawerTitle}</h2>
            <button type="button" className="close-btn" onClick={() => drawer.closeDrawer()}>
              ✕
            </button>
          </div>
        )}
        <div className="drawer-body">
          {showReviewActions ? (
            <BookingReviewActions
              orderId={reviewOrderId}
              onApproved={() => {
                drawer.setStatus(BOOKING_STATUS_AWAITING_PAYMENT);
                void onBookingReviewed?.();
              }}
              onRejected={() => {
                drawer.setStatus("Скасовано");
                void onBookingReviewed?.();
              }}
            />
          ) : null}
          <BookingFormSectionHeading compact title="Статус броні" />
          <div className="status-toggle">
            {(["Очікує оплату", "Підтверджено", "Скасовано"] as const).map((status) => (
              <div
                key={status}
                className={`status-btn${form.status === status ? " active" : ""}`}
                data-status={status}
                onClick={() => drawer.setStatus(status)}
              >
                <span className="status-dot" /> {status}
              </div>
            ))}
          </div>
          <div className="form-section booking-color-picker-section">
            <BookingColorPicker
              value={form.customColor}
              onChange={drawer.setCustomColor}
            />
          </div>
          <input type="hidden" id="adminCustomColor" value={form.customColor} readOnly />
          {isPendingReviewStatus(activeBooking?.status ?? form.status) ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13,
                color: "#92400E",
                fontWeight: 600,
              }}
            >
              Поточний статус: Очікує підтвердження
            </p>
          ) : null}
          <form id="adminBookingForm">
            <div className="form-section">
              <BookingFormSectionHeading title="Гість" />
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: "span 2" }}>
                  <label>Ім&apos;я та Прізвище:</label>
                  <input
                    type="text"
                    id="adminName"
                    required
                    value={form.name}
                    onChange={(e) => drawer.patchForm({ name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Телефон:</label>
                  <input
                    type="tel"
                    id="adminPhone"
                    required
                    value={form.phone}
                    onChange={(e) => drawer.patchForm({ phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Джерело:</label>
                  <div className="custom-select-wrapper" id="sourceWrapper">
                    <div
                      className="custom-select-trigger"
                      onClick={() => w().toggleCustomSelect?.("sourceWrapper")}
                    >
                      <span id="sourceSelectedText">{form.source}</span>
                      <svg width="16" height="16" fill="none" stroke="#6B7280" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="custom-select-options">
                      {ADMIN_SELECTABLE_SOURCES.map((src) => (
                        <div
                          key={src}
                          className="custom-option"
                          onClick={() => {
                            w().selectOption?.("sourceWrapper", "adminSource", src, null);
                            drawer.patchForm({ source: src });
                          }}
                        >
                          {src}
                        </div>
                      ))}
                    </div>
                  </div>
                  <input type="hidden" id="adminSource" value={form.source} readOnly />
                </div>
                <div className="form-group booking-comment-group" style={{ gridColumn: "span 2" }}>
                  <label>Коментар:</label>
                  <textarea
                    id="adminComment"
                    placeholder="Немає коментарів..."
                    style={
                      isMobile
                        ? {
                            minHeight: 80,
                            width: "100%",
                            boxSizing: "border-box",
                            padding: "14px 16px",
                            border: "1px solid #D1D5DB",
                            borderRadius: 12,
                            fontSize: 15,
                            background: "#F9FAFB",
                            outline: "none",
                            fontFamily: "inherit",
                            resize: "vertical",
                          }
                        : { minHeight: 80 }
                    }
                    value={form.comment}
                    onChange={(e) => drawer.patchForm({ comment: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <BookingFormSectionHeading title="Заїзд і опції" />
              <div className="form-group">
                <label>Номер / Котедж:</label>
                <div className="custom-select-wrapper" id="cottageWrapper">
                  <div className="custom-select-trigger" onClick={() => w().toggleCustomSelect?.("cottageWrapper")}>
                    <span id="cottageSelectedText">{form.cottageLabel}</span>
                    <svg width="16" height="16" fill="none" stroke="#6B7280" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div className="custom-select-options" id="cottageOptions" />
                </div>
                <input type="hidden" id="adminCottage" value={form.cottage} readOnly />
                <input
                  type="hidden"
                  id="adminRoomId"
                  value={form.roomId != null ? String(form.roomId) : ""}
                  readOnly
                />
              </div>

              <div className="form-group booking-stay-calendar-wrap">
                <label>Дати перебування:</label>
                <BookingStayRangeCalendar
                  checkIn={form.checkIn}
                  checkOut={form.checkOut}
                  onChange={(checkIn, checkOut) => {
                    drawer.patchForm({ checkIn, checkOut });
                    drawer.bumpPrice();
                  }}
                />
                <input type="hidden" id="adminCheckIn" value={form.checkIn} readOnly required />
                <input type="hidden" id="adminCheckOut" value={form.checkOut} readOnly required />
                <BookingNightlyBreakdown
                  checkIn={form.checkIn}
                  checkOut={form.checkOut}
                  room={selectedRoom}
                  customPrices={settings.customPrices}
                  priceOverrides={nightlyPriceOverrides}
                  onPriceChange={handleNightlyPriceChange}
                  discountAmount={instantDiscountAmount}
                  discountPercent={instantDiscountPercent}
                  onDiscountAmountChange={handleInstantDiscountAmountChange}
                  onDiscountPercentChange={handleInstantDiscountPercentChange}
                />
              </div>
              <div className="form-grid">
                <BookingGuestsAndServicesFields
                  adults={form.guests}
                  children={form.children}
                  youngestChildAge={form.youngestChildAge}
                  maxOccupants={drawer.maxOccupants}
                  showChildren={drawer.showChildren}
                  childrenPolicyMessage={drawer.childrenPolicyMessage}
                  selectedServices={form.selectedServices}
                  availableServices={drawer.availableServices}
                  onChangeAdults={drawer.changeGuests}
                  onChangeChildren={drawer.changeChildren}
                  onChangeYoungestChildAge={drawer.changeYoungestChildAge}
                  onSetServiceQty={drawer.setServiceQty}
                />
                <BookingSpecialTariffsFields
                  toggles={drawer.specialTariffToggles}
                  values={form.specialTariffs}
                  onChange={drawer.setSpecialTariff}
                />
                {showPromoCode ? (
                  <BookingPromoCodeField
                    value={form.promoCode}
                    onChange={(promoCode) => drawer.patchForm({ promoCode })}
                    status={promoStatus}
                  />
                ) : null}
              </div>

              <div style={{ marginTop: 16, borderTop: "1px dashed #E5E7EB", paddingTop: 16 }}>
                <BookingFormSectionHeading
                  compact
                  className="booking-form-section-heading--inset"
                  title="Гнучкий графік"
                />
                <div className={`service-card${form.earlyCardActive ? " active" : ""}`} id="adminCardEarly">
                  <div className="srv-header" onClick={() => drawer.toggleAdminService("early")}>
                    <div className="srv-title">
                      <svg viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Ранній заїзд
                    </div>
                    <div className="srv-price" id="adminLabelPriceEarly">
                      {drawer.scheduleLabels.early}
                    </div>
                  </div>
                  <div className="srv-body">
                    <div style={{ fontSize: 12, color: "#4B5563", fontWeight: 500 }}>Оберіть годину заїзду:</div>
                    <div className="time-chips">
                      {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00"].map((t) => (
                        <div
                          key={t}
                          className={`t-chip${drawer.earlyTime === t ? " selected" : ""}`}
                          onClick={(e) => drawer.selectAdminTime("early", t, e.currentTarget)}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={`service-card${form.lateCardActive ? " active" : ""}`} id="adminCardLate">
                  <div className="srv-header" onClick={() => drawer.toggleAdminService("late")}>
                    <div className="srv-title">
                      <svg viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M12 7v5l2.5 2.5" />
                      </svg>
                      Пізній виїзд
                    </div>
                    <div className="srv-price" id="adminLabelPriceLate">
                      {drawer.scheduleLabels.late}
                    </div>
                  </div>
                  <div className="srv-body">
                    <div style={{ fontSize: 12, color: "#4B5563", fontWeight: 500 }}>Оберіть годину виїзду:</div>
                    <div className="time-chips">
                      {["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"].map(
                        (t) => (
                          <div
                            key={t}
                            className={`t-chip${drawer.lateTime === t ? " selected" : ""}`}
                            onClick={(e) => drawer.selectAdminTime("late", t, e.currentTarget)}
                          >
                            {t}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="liveCalculatorContainer">
              {drawer.drawerOpen && (
              <BookingPriceCalculator
                form={drawer.priceForm}
                isInitialLoad={drawer.isInitialPriceLoad}
                onInitialLoadDone={drawer.finishInitialPriceLoad}
                settings={settings}
                bookings={bookings}
                editingRow={drawer.editingRow}
                editingBookingId={drawer.editingBookingId}
                selectedEarlyTime={drawer.earlyTime}
                selectedLateTime={drawer.lateTime}
                onGuestsChange={(guests) => drawer.patchForm({ guests })}
                onOverlapChange={drawer.applySubmitDisabled}
                onScheduleLabelsChange={drawer.applyScheduleLabels}
                onStatusFromPayment={drawer.handleStatusFromPayment}
                bookingStatus={form.status}
                initialPrepay={drawer.initialPayment.prepay}
                initialSurcharge={drawer.initialPayment.surcharge}
                initialPrepayMethod={drawer.initialPayment.prepayMethod}
                initialSurchargeMethod={drawer.initialPayment.surchargeMethod}
                nightlyBaseSum={nightlyOverridesActive ? nightlyBaseSum : null}
                onClearNightlyPriceOverrides={clearNightlyPriceOverrides}
                instantDiscountAmount={instantDiscountAmount}
                onInstantDiscountHydrate={hydrateInstantDiscount}
              />
              )}
            </div>
          </form>
        </div>
        <div className={`drawer-footer${isMobile ? " drawer-footer--mobile" : ""}`}>
          <div className="drawer-footer-actions">
            <button
              type="button"
              className="btn-outline-danger drawer-footer-delete"
              id="adminDeleteBtn"
              onClick={() => w().deleteCurrentBooking?.()}
              style={{
                display: drawer.showDeleteBtn ? "flex" : "none",
                ...(isMobile
                  ? {
                      flex: "0 0 48px",
                      width: 48,
                      minWidth: 48,
                      margin: 0,
                      padding: 12,
                    }
                  : {}),
              }}
              aria-label="Видалити"
            >
              {isMobile ? (
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              ) : (
                "Видалити"
              )}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => drawer.closeDrawer()}
              style={isMobile ? { flex: 1, margin: 0, whiteSpace: "nowrap" } : undefined}
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="btn-primary"
              form="adminBookingForm"
              id="adminSubmitBtn"
              disabled={drawer.submitDisabled || drawer.childrenPolicyBlocked}
              style={{
                ...(isMobile ? { flex: 1, margin: 0, whiteSpace: "nowrap" } : {}),
                ...(drawer.submitDisabled || drawer.childrenPolicyBlocked
                  ? { opacity: 0.5, cursor: "not-allowed" }
                  : { opacity: 1, cursor: "pointer" }),
              }}
            >
              Зберегти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
