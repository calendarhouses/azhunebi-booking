"use client";

import { DesktopIcons } from "@/lib/public-booking/desktopIcons";
import { usePublicBooking } from "./PublicBookingProvider";
import { CabinCardMobile } from "./CabinCardMobile";
import { MobileBookingDrawer } from "./mobile/MobileBookingDrawer";

export function PublicMobileSite() {
  const {
    runtime,
    preloaderVisible,
    activeScreen,
    setActiveScreen,
    openDrawer,
    getNextFreeForRoom,
    successReceiptHtml,
  } = usePublicBooking();

  const preloaderTitle = runtime?.tenantName || "Завантаження";
  const telegramUrl = (runtime?.branding.telegram_url as string) || "#";

  return (
    <>
      <div
        id="preloader"
        style={{
          display: preloaderVisible ? "flex" : "none",
          opacity: preloaderVisible ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        <div className="preloader-content">
          <div className="pulse-logo">{preloaderTitle}</div>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" />
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: "#6B7280" }}>Завантаження...</p>
        </div>
      </div>

      <div id="screen-list" className={`screen ${activeScreen === "list" ? "active" : ""}`}>
        <div className="page-wrap" id="cabinsContainer">
          {!runtime || runtime.rooms.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>Котеджів не знайдено</div>
          ) : (
            runtime.rooms.map((room) => (
              <CabinCardMobile
                key={room.id}
                room={room}
                customPrices={runtime.customPrices}
                nextFreeLabel={getNextFreeForRoom(room)}
                onBook={() => openDrawer(room)}
              />
            ))
          )}
        </div>
      </div>

      <MobileBookingDrawer />

      <div id="screen-success" className={`screen ${activeScreen === "success" ? "active" : ""}`}>
        <div className="page-wrap" style={{ paddingTop: 60 }}>
          <div className="success-wrap">
            <div className="success-icon-premium">{DesktopIcons.check}</div>
            <h2>Підтверджено</h2>
            <p>Оплата пройшла успішно. Ваші апартаменти заброньовано.</p>
            <div
              className="success-receipt"
              id="successDetail"
              dangerouslySetInnerHTML={{ __html: successReceiptHtml }}
            />
            <a href={telegramUrl} className="btn-tg">
              <svg viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.18-5.18 3.44-.49.33-.93.49-1.33.48-.44-.01-1.28-.24-1.91-.44-.77-.24-1.38-.37-1.32-.78.03-.22.34-.44.93-.68 3.63-1.58 6.06-2.63 7.28-3.13 3.47-1.42 4.18-1.67 4.65-1.68.1 0 .33.02.45.1.1.06.13.14.14.21-.01.04-.01.12-.02.21z" />
              </svg>
              Телеграм Консьєрж
            </a>
            <div style={{ textAlign: "center" }}>
              <button
                type="button"
                className="btn-home-link"
                onClick={() => {
                  sessionStorage.removeItem("lastBooking");
                  setActiveScreen("list");
                }}
              >
                Забронювати ще один котедж
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="toast" />
    </>
  );
}
