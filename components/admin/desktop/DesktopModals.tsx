"use client";

import { MobileSheetHeader } from "../mobile/MobileSheetHeader";
import { useMobileUi } from "../mobile/MobileUiContext";
import { RoomSettingsDrawer } from "../rooms/RoomSettingsDrawer";
import { PriceConstructorDrawer } from "./settings/PriceConstructorDrawer";
import { GenericModalContent } from "./settings/GenericModalContent";
import type { AdminModalsApi } from "./useAdminModals";
import type { AdminSettingsPayload } from "./types";

export interface DesktopModalsProps {
  modals: AdminModalsApi;
  settings: AdminSettingsPayload;
}

export function DesktopModals({ modals, settings }: DesktopModalsProps) {
  const isMobile = useMobileUi();
  const roomDrawerTitle = modals.roomDrawerId ? "Редагувати котедж" : "Новий котедж";

  return (
    <>
      <PriceConstructorDrawer
        open={modals.priceDrawerOpen}
        saving={modals.priceSaving}
        settings={settings}
        priceForm={modals.priceForm}
        onClose={modals.closePriceConstructor}
        onSave={modals.savePriceConstructor}
        onChange={(updater) => modals.setPriceForm(updater)}
      />
      <RoomSettingsDrawer
        open={modals.roomDrawerOpen}
        title={roomDrawerTitle}
        initialTab={modals.roomDrawerInitialTab}
        roomId={modals.roomDrawerId}
        roomForm={modals.roomForm}
        saving={modals.roomPhotosBusy}
        loading={modals.roomDrawerLoading}
        onClose={modals.closeRoomDrawer}
        onSave={modals.saveRoomDrawer}
        onDelete={modals.deleteRoomDrawer}
        onRoomFormChange={(updater) => modals.setRoomForm((prev) => updater(prev))}
      />
      <div
        id="genericModal"
        className={`modal-overlay ${modals.genericOpen ? "active" : ""}`}
      >
        <div className="modal-box">
          {isMobile ? (
            <MobileSheetHeader
              className="modal-header"
              title={<span id="gModalTitle">{modals.modalTitle}</span>}
              onClose={() => modals.closeGenericModal()}
            />
          ) : (
            <div className="modal-header">
              <span id="gModalTitle">{modals.modalTitle}</span>
              <button
                type="button"
                className="close-btn"
                style={{ width: 28, height: 28 }}
                onClick={() => modals.closeGenericModal()}
              >
                ✕
              </button>
            </div>
          )}
          <div className="modal-body" id="gModalBody">
            {modals.genericOpen && modals.editType !== "room" && modals.editType !== "price" && (
              <GenericModalContent
                type={modals.editType}
                settings={settings}
                roomForm={modals.roomForm}
                setRoomForm={modals.setRoomForm}
                priceForm={modals.priceForm}
                setPriceForm={modals.setPriceForm}
                restrictionForm={modals.restrictionForm}
                setRestrictionForm={modals.setRestrictionForm}
                discountForm={modals.discountForm}
                setDiscountForm={modals.setDiscountForm}
                customServiceForm={modals.customServiceForm}
                setCustomServiceForm={modals.setCustomServiceForm}
                sysServiceForm={modals.sysServiceForm}
                setSysServiceForm={modals.setSysServiceForm}
                transactionForm={modals.transactionForm}
                setTransactionForm={modals.setTransactionForm}
                roomEditId={null}
                roomPhotosBusy={modals.roomPhotosBusy}
                onRoomPhotosSelected={undefined}
              />
            )}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn-outline-danger"
              id="modalDeleteBtn"
              disabled={modals.roomPhotosBusy}
              onClick={() => modals.deleteGenericItem()}
              style={{
                display: modals.showDeleteBtn ? "flex" : "none",
                height: 46,
                margin: 0,
                padding: isMobile ? 12 : "0 16px",
                width: isMobile ? 48 : undefined,
                minWidth: isMobile ? 48 : undefined,
                flex: isMobile ? "0 0 48px" : undefined,
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
              onClick={() => modals.closeGenericModal()}
              disabled={modals.roomPhotosBusy}
              style={{ height: 46, margin: 0, flex: isMobile ? 1 : undefined }}
            >
              Скасувати
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void modals.saveGenericModal()}
              disabled={modals.roomPhotosBusy}
              style={{ height: 46, margin: 0, flex: isMobile ? 1 : undefined }}
            >
              {modals.roomPhotosBusy ? "Оптимізація та завантаження..." : "Зберегти"}
            </button>
          </div>
        </div>
      </div>

      <div
        id="restrictionBarMenu"
        className="restriction-bar-menu"
        role="menu"
        style={{ display: "none" }}
      >
        <button type="button" onClick={() => modals.openRestrictionConstructor()}>
          Конструктор обмежень
        </button>
        <button type="button" className="danger" onClick={() => modals.clearRestrictionsAlert()}>
          Видалити обмеження
        </button>
      </div>

      <div id="financeReportResultModal" className="modal-overlay" style={{ zIndex: 3100 }}>
        <div
          className="modal-box"
          style={{ maxWidth: 400, textAlign: "center", padding: "36px 28px 28px" }}
        >
          <div
            id="financeReportModalIcon"
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              background: "#ECFDF5",
              color: "#059669",
            }}
          />
          <h3
            id="financeReportModalTitle"
            style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 10 }}
          >
            Готово!
          </h3>
          <p
            id="financeReportModalDesc"
            style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, lineHeight: 1.55 }}
          >
            Фінансовий звіт надіслано в Telegram.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              (window as Window & { closeFinanceReportResultModal?: () => void })
                .closeFinanceReportResultModal?.()
            }
            style={{ width: "100%", height: 46, margin: 0, justifyContent: "center" }}
          >
            Зрозуміло
          </button>
        </div>
      </div>

      <div
        id="customConfirmModal"
        className={`modal-overlay ${modals.confirmOpen ? "active" : ""}`}
        style={{ zIndex: 3000 }}
      >
        <div className="modal-box" style={{ maxWidth: 380, textAlign: "center", padding: "30px 24px" }}>
          <div
            style={{
              background: "#FEE2E2",
              color: "#DC2626",
              width: 64,
              height: 64,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
          <h3
            id="confirmModalTitle"
            style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 10 }}
          >
            {modals.confirmTitle || "Видалити?"}
          </h3>
          <p
            id="confirmModalDesc"
            style={{ fontSize: 14, color: "#6B7280", marginBottom: 24, lineHeight: 1.5 }}
          >
            {modals.confirmDesc || "Цю дію неможливо скасувати."}
          </p>
          <div className="confirm-modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => modals.closeCustomConfirm()}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Скасувати
            </button>
            <button
              type="button"
              id="confirmModalActionBtn"
              className="btn-primary confirm-modal-actions__delete"
              onClick={() => void modals.runConfirmAction()}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              Видалити
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
