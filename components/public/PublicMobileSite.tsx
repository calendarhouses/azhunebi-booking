"use client";

import { MessageCircle, Phone } from "lucide-react";
import { DesktopIcons } from "@/lib/public-booking/desktopIcons";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";
import { toImageDisplaySrc } from "@/lib/driveImageUrl";
import { BRAND_ICONS } from "@/lib/brandIcons";
import { usePublicBooking } from "./PublicBookingProvider";
import {
  PublicAvailabilityFilter,
  PublicCabinsEmptyState,
} from "./PublicAvailabilityFilter";
import { PublicPreloader } from "./PublicPreloader";
import { CabinCardMobile } from "./CabinCardMobile";
import { MobileBookingDrawer } from "./mobile/MobileBookingDrawer";

export function PublicMobileSite() {
  const {
    runtime,
    preloaderVisible,
    initFailed,
    activeScreen,
    setActiveScreen,
    openDrawer,
    getNextFreeForRoom,
    filteredRooms,
    listFilterActive,
    successReceiptHtml,
    successFlow,
  } = usePublicBooking();

  const logoUrl = (() => {
    const raw = String(runtime?.branding?.logo_url || "").trim();
    if (raw) return toImageDisplaySrc(raw, 128);
    return BRAND_ICONS.icon192;
  })();
  const siteTitle = (runtime?.branding.site_title as string) || runtime?.tenantName || null;
  const brandName = siteTitle || runtime?.tenantName || "Бронювання";
  const contactDigits = normalizeGuestPhone(
    String(runtime?.branding?.contact_phone || "")
  );
  const hasContact = contactDigits.length >= 10;
  const telHref = hasContact ? `tel:+${contactDigits}` : "";
  const telegramHref = hasContact ? `https://t.me/+${contactDigits}` : "";
  const rooms = filteredRooms;
  const showEmpty = Boolean(runtime && listFilterActive && rooms.length === 0);
  const showLoading = !runtime || runtime.rooms.length === 0;

  return (
    <>
      <PublicPreloader
        visible={preloaderVisible}
        failed={initFailed}
        logoUrl={runtime?.branding?.logo_url as string | null}
        alt={siteTitle}
      />

      <div id="screen-list" className={`screen ${activeScreen === "list" ? "active" : ""}`}>
        <header className="public-mobile-brand">
          <div className="public-mobile-brand__inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="public-mobile-brand__logo" src={logoUrl} alt={brandName} />
            <div className="public-mobile-brand__text">
              <h1 className="public-mobile-brand__title">{brandName}</h1>
            </div>
            {hasContact ? (
              <div className="public-mobile-brand__actions">
                <a
                  className="public-mobile-brand__action"
                  href={telHref}
                  aria-label="Зателефонувати"
                >
                  <Phone size={18} strokeWidth={2.25} aria-hidden />
                </a>
                <a
                  className="public-mobile-brand__action"
                  href={telegramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Написати в Telegram"
                >
                  <MessageCircle size={18} strokeWidth={2.25} aria-hidden />
                </a>
              </div>
            ) : null}
          </div>
        </header>

        <div className="public-mobile-list-body">
          <div className="stay-filter-shell stay-filter-shell--mobile">
            <PublicAvailabilityFilter layout="mobile" />
          </div>

          <div className="page-wrap" id="cabinsContainer">
            {showLoading ? (
              <div className="loading-state">
                <div className="loader" />
                Котеджів не знайдено
              </div>
            ) : showEmpty ? (
              <PublicCabinsEmptyState />
            ) : (
              rooms.map((room) => (
                <CabinCardMobile
                  key={room.id}
                  room={room}
                  customPrices={runtime!.customPrices}
                  nextFreeLabel={getNextFreeForRoom(room)}
                  onBook={() => openDrawer(room)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <MobileBookingDrawer />

      <div id="screen-success" className={`screen ${activeScreen === "success" ? "active" : ""}`}>
        <div className="page-wrap page-wrap--success">
          <div className="success-wrap fade-in">
            <div
              className={`success-icon-premium${successFlow === "pending_review" ? " success-icon-premium--pending" : ""}`}
            >
              {successFlow === "pending_review" ? DesktopIcons.clock : DesktopIcons.check}
            </div>
            <h2>
              {successFlow === "pending_review"
                ? "Заявку надіслано"
                : "Бронювання підтверджено"}
            </h2>
            <p>
              {successFlow === "pending_review"
                ? "Очікуйте підтвердження. Ми надішлемо вам SMS з деталями та посиланням на оплату."
                : "Будинок заброньовано, деталі вказані нижче."}
            </p>
            <div
              className="success-receipt"
              id="successDetail"
              dangerouslySetInnerHTML={{ __html: successReceiptHtml }}
            />
            <button
              type="button"
              className="btn-book btn-book--success"
              onClick={() => {
                sessionStorage.removeItem("lastBooking");
                setActiveScreen("list");
              }}
            >
              Забронювати ще один будинок
            </button>
          </div>
        </div>
      </div>

      <div id="toast" />
    </>
  );
}
