"use client";

import { MapPin, MessageCircle, Phone } from "lucide-react";
import { DesktopIcons } from "@/lib/public-booking/desktopIcons";
import { normalizeGuestPhone } from "@/lib/admin/guestMessengerLinks";
import { toImageDisplaySrc } from "@/lib/driveImageUrl";
import { BRAND_ICONS } from "@/lib/brandIcons";
import { usePublicBooking } from "./PublicBookingProvider";
import { PublicAvailabilityFilter } from "./PublicAvailabilityFilter";
import { PublicCabinList } from "./PublicCabinList";
import { PublicPreloader } from "./PublicPreloader";
import { MobileBookingDrawer } from "./mobile/MobileBookingDrawer";

export function PublicMobileSite() {
  const {
    runtime,
    preloaderVisible,
    activeScreen,
    setActiveScreen,
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
  const mapsHref = String(runtime?.branding?.maps_external_url || "").trim();
  const hasMaps = /^https?:\/\//i.test(mapsHref);
  const showBrandActions = hasMaps || hasContact;

  return (
    <>
      <PublicPreloader visible={preloaderVisible} logoUrl={runtime?.branding?.logo_url as string | null} alt={siteTitle} />

      <div id="screen-list" className={`screen ${activeScreen === "list" ? "active" : ""}`}>
        <header className="public-mobile-brand">
          <div className="public-mobile-brand__inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="public-mobile-brand__logo" src={logoUrl} alt={brandName} />
            <div className="public-mobile-brand__text">
              <h1 className="public-mobile-brand__title">{brandName}</h1>
            </div>
            {showBrandActions ? (
              <div className="public-mobile-brand__actions">
                {hasMaps ? (
                  <a
                    className="public-mobile-brand__action"
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Відкрити на Google Maps"
                  >
                    <MapPin size={18} strokeWidth={2.25} aria-hidden />
                  </a>
                ) : null}
                {hasContact ? (
                  <>
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
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>

        <div className="public-mobile-list-body">
          <div className="stay-filter-shell stay-filter-shell--mobile">
            <PublicAvailabilityFilter layout="mobile" />
          </div>

          <div className="page-wrap" id="cabinsContainer">
            <PublicCabinList layout="mobile" />
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
                ? "Очікуйте підтвердження адміністратором. Ми звʼяжемося з вами після перевірки заявки."
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
