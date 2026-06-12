import type { AdminModalsApi } from "./useAdminModals";

/** Реєстрація window.* для сумісності з legacy onclick та поступової міграції. */
export function registerAdminDesktopHandlers(modals: AdminModalsApi): () => void {
  if (typeof window === "undefined") return () => {};

  const w = window as Window & {
    openGenericModal?: (type: string, id?: number | null) => void;
    closeGenericModal?: () => void;
    saveGenericModal?: () => void;
    deleteGenericItem?: (type?: string, id?: number | null) => void;
    confirmDeleteGenericItem?: () => void;
    openCustomConfirm?: (title: string, desc: string, action: () => void) => void;
    closeCustomConfirm?: () => void;
    clearPricesAlert?: () => void;
    confirmClearPrices?: () => void;
    clearRestrictionsAlert?: () => void;
    openRestrictionConstructor?: () => void;
    restrictionMenuConstructor?: () => void;
    restrictionMenuDelete?: () => void;
    renderSettingsRooms?: () => void;
    renderSettingsDiscounts?: () => void;
    renderSettingsServices?: () => void;
    renderPriceGrid?: () => void;
    renderRestrictionsGrid?: () => void;
    scrollToRestrictionsGrid?: () => void;
    shiftPriceTimeline?: (months: number) => void;
    resetPriceTimelineToToday?: () => void;
    shiftRestrictionsTimeline?: (months: number) => void;
    resetRestrictionsTimelineToToday?: () => void;
    toggleRoomStatus?: (val: string) => void;
    changeTransType?: (newType: string) => void;
    toggleAllRestrRoomsChip?: () => void;
    toggleSingleRestrRoomChip?: (el: HTMLElement) => void;
    selectRestrDayChip?: (el: HTMLElement) => void;
    selectRestrPeriodChip?: (el: HTMLElement) => void;
  };

  w.openGenericModal = (type, id) =>
    modals.openGenericModal(type as Parameters<typeof modals.openGenericModal>[0], id ?? null);
  w.closeGenericModal = () => modals.closeGenericModal();
  w.saveGenericModal = () => void modals.saveGenericModal();
  w.deleteGenericItem = (type, id) =>
    modals.deleteGenericItem(
      type as Parameters<typeof modals.deleteGenericItem>[0],
      id ?? null
    );
  w.confirmDeleteGenericItem = () => void modals.confirmDeleteGenericItem();
  w.openCustomConfirm = (title, desc, action) => modals.openCustomConfirm(title, desc, action);
  w.closeCustomConfirm = () => modals.closeCustomConfirm();
  w.clearPricesAlert = () => modals.clearPricesAlert();
  w.confirmClearPrices = () => void modals.confirmClearPrices();
  w.clearRestrictionsAlert = () => modals.clearRestrictionsAlert();
  w.openRestrictionConstructor = () => modals.openRestrictionConstructor();
  w.restrictionMenuConstructor = () => {
    document.getElementById("restrictionBarMenu")?.style.setProperty("display", "none");
    modals.openRestrictionConstructor();
  };
  w.restrictionMenuDelete = () => {
    document.getElementById("restrictionBarMenu")?.style.setProperty("display", "none");
    modals.clearRestrictionsAlert();
  };

  w.renderSettingsRooms = () => {};
  w.renderSettingsDiscounts = () => {};
  w.renderSettingsServices = () => {};
  w.toggleRoomStatus = (val: string) => {
    document.querySelectorAll(".room-status-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-val") === val);
    });
    const hidden = document.getElementById("mRoomStatus") as HTMLInputElement | null;
    if (hidden) hidden.value = val;
  };

  return () => {
    delete w.openGenericModal;
    delete w.closeGenericModal;
    delete w.saveGenericModal;
    delete w.deleteGenericItem;
    delete w.confirmDeleteGenericItem;
    delete w.openCustomConfirm;
    delete w.closeCustomConfirm;
    delete w.clearPricesAlert;
    delete w.clearRestrictionsAlert;
    delete w.openRestrictionConstructor;
    delete w.restrictionMenuConstructor;
    delete w.restrictionMenuDelete;
    delete w.renderSettingsRooms;
    delete w.renderSettingsDiscounts;
    delete w.renderSettingsServices;
    delete w.renderPriceGrid;
    delete w.renderRestrictionsGrid;
    delete w.toggleRoomStatus;
  };
}
