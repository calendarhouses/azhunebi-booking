"use client";

import { MobileSheetHeader } from "../mobile/MobileSheetHeader";
import { useMobileUi } from "../mobile/MobileUiContext";
import { BookingPriceCalculator } from "./BookingPriceCalculator";
import { BookingFormSectionHeading } from "./BookingFormSectionHeading";
import { SpecialTariffToggleField } from "./SpecialTariffToggleField";
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
}

export function DesktopBookingDrawer({
  roomsList: _roomsList,
  drawer,
  settings,
  bookings,
}: DesktopBookingDrawerProps) {
  void _roomsList;
  const { form } = drawer;
  const isMobile = useMobileUi();

  return (
    <div id="bookingDrawer" className="drawer-overlay">
      <div className="drawer">
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
          <BookingFormSectionHeading
            compact
            title="Статус броні"
            description="Обери, на якому етапі зараз це бронювання — можна змінити в будь-який момент."
          />
          <div className="status-toggle">
            {(["Нова бронь", "Підтверджено", "Скасовано"] as const).map((status) => (
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
          <form id="adminBookingForm">
            <div className="form-section">
              <BookingFormSectionHeading
                title="Гість"
                description="Вкажи імʼя, телефон і звідки прийшло бронювання — це побачиш у картці та в коментарі."
              />
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
                      {["Адмінка", "Instagram", "Telegram", "Телефон"].map((src) => (
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
              <BookingFormSectionHeading
                title="Заїзд і опції"
                description="Обери котедж, дати та перемикачі — від них залежить розрахунок у розшифровці нижче."
              />
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

              <div className="form-grid">
                <div className="form-group">
                  <label>Дата заїзду:</label>
                  <input
                    type="text"
                    id="adminCheckIn"
                    required
                    readOnly
                    autoComplete="off"
                    placeholder="Оберіть дату"
                  />
                </div>
                <div className="form-group">
                  <label>Дата виїзду:</label>
                  <input
                    type="text"
                    id="adminCheckOut"
                    required
                    readOnly
                    autoComplete="off"
                    placeholder="Оберіть дату"
                  />
                </div>
                <div className="form-group">
                  <label>Дорослих:</label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "#F9FAFB",
                      borderRadius: 12,
                      border: "1px solid #D1D5DB",
                      height: 48,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => drawer.changeGuests(-1)}
                      style={{
                        width: 50,
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#FEF2F2",
                        color: "#DC2626",
                        border: "none",
                        borderRight: "1px solid #FECACA",
                        fontSize: 24,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      id="adminGuests"
                      min={1}
                      readOnly
                      value={form.guests}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        background: "transparent",
                        border: "none",
                        fontSize: 16,
                        fontWeight: 700,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => drawer.changeGuests(1)}
                      style={{
                        width: 50,
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#F0FDF4",
                        color: "#059669",
                        border: "none",
                        borderLeft: "1px solid #A7F3D0",
                        fontSize: 22,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Тварини:</label>
                  <div
                    className="mode-toggle"
                    style={{
                      margin: 0,
                      width: "100%",
                      display: "flex",
                      padding: 4,
                      background: "#F3F4F6",
                      borderRadius: 12,
                      height: 48,
                    }}
                  >
                    <div
                      className={`mode-btn pet-btn${form.pets === "Ні" ? " active" : ""}`}
                      data-val="Ні"
                      onClick={() => drawer.setPets("Ні")}
                    >
                      Ні
                    </div>
                    <div
                      className={`mode-btn pet-btn${form.pets === "Так" ? " active" : ""}`}
                      data-val="Так"
                      onClick={() => drawer.setPets("Так")}
                    >
                      Так
                    </div>
                  </div>
                  <input type="hidden" id="adminPets" value={form.pets} readOnly />
                </div>
                <div className="form-group">
                  <label>Денні гості (+500 грн):</label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      background: "#F9FAFB",
                      borderRadius: 12,
                      border: "1px solid #D1D5DB",
                      height: 48,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => drawer.changeAdminDayGuests(-1)}
                      style={{
                        width: 50,
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#FEF2F2",
                        color: "#DC2626",
                        border: "none",
                        fontSize: 24,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      id="adminDayGuests"
                      min={0}
                      readOnly
                      value={form.dayGuests}
                      style={{ flex: 1, textAlign: "center", border: "none", fontSize: 16, fontWeight: 700 }}
                    />
                    <button
                      type="button"
                      onClick={() => drawer.changeAdminDayGuests(1)}
                      style={{
                        width: 50,
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#F0FDF4",
                        color: "#059669",
                        border: "none",
                        fontSize: 22,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Чан:</label>
                  <div
                    className="mode-toggle"
                    style={{
                      margin: 0,
                      width: "100%",
                      display: "flex",
                      padding: 4,
                      background: "#F3F4F6",
                      borderRadius: 12,
                      height: 48,
                    }}
                  >
                    <button
                      type="button"
                      className={`mode-btn chan-btn${form.vat === "Ні" ? " active" : ""}`}
                      data-val="Ні"
                      onClick={() => drawer.setVat("Ні")}
                    >
                      Ні
                    </button>
                    <button
                      type="button"
                      className={`mode-btn chan-btn${form.vat === "Так" ? " active" : ""}`}
                      data-val="Так"
                      onClick={() => drawer.setVat("Так")}
                    >
                      Так
                    </button>
                  </div>
                  <input type="hidden" id="adminVat" value={form.vat} readOnly />
                </div>
                {drawer.specialTariffToggles.length > 0 ? (
                  <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                    <BookingFormSectionHeading
                      compact
                      className="booking-form-section-heading--inset"
                      title="Спецтарифи"
                      description="Увімкни потрібні знижки для гостя — вони зʼявляться в розшифровці ціни."
                    />
                  </div>
                ) : null}
                {drawer.specialTariffToggles.map((toggle) => (
                  <SpecialTariffToggleField
                    key={toggle.id}
                    tariffId={toggle.id}
                    label={toggle.label}
                    value={form.specialTariffs[toggle.id] ?? "Ні"}
                    onChange={(val) => drawer.setSpecialTariff(toggle.id, val)}
                  />
                ))}
                {drawer.specialTariffToggles.length % 2 === 1 ? <div /> : null}
              </div>

              <div style={{ marginTop: 16, borderTop: "1px dashed #E5E7EB", paddingTop: 16 }}>
                <BookingFormSectionHeading
                  compact
                  className="booking-form-section-heading--inset"
                  title="Гнучкий графік"
                  description="Додай ранній заїзд або пізній виїзд, якщо домовлялись окремо з гостем."
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
                ...(isMobile ? { flex: 1, margin: 0, height: 46, whiteSpace: "nowrap" } : {}),
              }}
              aria-label="Видалити"
            >
              Видалити
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => drawer.closeDrawer()}
              style={isMobile ? { flex: 1, margin: 0, height: 46, whiteSpace: "nowrap" } : undefined}
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="btn-primary"
              form="adminBookingForm"
              id="adminSubmitBtn"
              disabled={drawer.submitDisabled}
              style={{
                ...(isMobile ? { flex: 1, margin: 0, height: 46, whiteSpace: "nowrap" } : {}),
                ...(drawer.submitDisabled
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
