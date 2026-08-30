import { DesktopIcons } from "@/lib/public-booking/desktopIcons";
import { usePublicBooking } from "./PublicBookingProvider";
import { PublicAvailabilityFilter } from "./PublicAvailabilityFilter";
import { PublicCabinList } from "./PublicCabinList";
import { PublicPreloader } from "./PublicPreloader";
import { DesktopBookingDrawer } from "./desktop/DesktopBookingDrawer";

export function PublicDesktopSite() {
  const {
    runtime,
    preloaderVisible,
    activeScreen,
    setActiveScreen,
    successReceiptHtml,
    successFlow,
  } = usePublicBooking();

  const logoUrl = (runtime?.branding.logo_url as string) || null;
  const siteTitle = (runtime?.branding.site_title as string) || runtime?.tenantName || null;

  return (
    <>
      <PublicPreloader visible={preloaderVisible} logoUrl={logoUrl} alt={siteTitle} />

      <div id="screen-list" className={`screen ${activeScreen === "list" ? "active" : ""}`}>
        <div className="stay-filter-shell">
          <PublicAvailabilityFilter layout="desktop" />
        </div>

        <div className="page-wrap" id="cabinsContainer">
          <PublicCabinList layout="desktop" />
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
