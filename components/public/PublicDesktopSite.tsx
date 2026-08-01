import { DesktopIcons } from "@/lib/public-booking/desktopIcons";
import { usePublicBooking } from "./PublicBookingProvider";
import {
  PublicAvailabilityFilter,
  PublicCabinsEmptyState,
} from "./PublicAvailabilityFilter";
import { PublicPreloader } from "./PublicPreloader";
import { DesktopBookingDrawer } from "./desktop/DesktopBookingDrawer";
import { DesktopCabinCard } from "./desktop/DesktopCabinCard";

export function PublicDesktopSite() {
  const {
    runtime,
    preloaderVisible,
    initFailed,
    availabilityLoading,
    activeScreen,
    setActiveScreen,
    openDrawer,
    getNextFreeForRoom,
    filteredRooms,
    listFilterActive,
    successReceiptHtml,
    successFlow,
  } = usePublicBooking();

  const logoUrl = (runtime?.branding.logo_url as string) || null;
  const siteTitle = (runtime?.branding.site_title as string) || runtime?.tenantName || null;
  const rooms = filteredRooms;
  const showEmpty = Boolean(
    runtime && listFilterActive && !availabilityLoading && !initFailed && rooms.length === 0
  );
  const showLoading = !runtime || runtime.rooms.length === 0;

  return (
    <>
      <PublicPreloader
        visible={preloaderVisible}
        failed={false}
        logoUrl={logoUrl}
        alt={siteTitle}
      />

      <div id="screen-list" className={`screen ${activeScreen === "list" ? "active" : ""}`}>
        {initFailed ? (
          <div className="availability-banner availability-banner--error" role="alert">
            Не вдалося оновити вільні дати.{" "}
            <button type="button" onClick={() => window.location.reload()}>
              Спробувати ще
            </button>
          </div>
        ) : availabilityLoading ? (
          <div className="availability-banner" role="status">
            Оновлюємо вільні дати…
          </div>
        ) : null}
        <div className="stay-filter-shell">
          <PublicAvailabilityFilter layout="desktop" />
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
              <DesktopCabinCard
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

      <DesktopBookingDrawer />

      <div id="screen-success" className={`screen ${activeScreen === "success" ? "active" : ""}`}>
        <div className="page-wrap">
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
