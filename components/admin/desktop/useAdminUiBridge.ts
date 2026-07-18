"use client";

import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import {
  expireAdminSession,
  isAdminUnauthorizedError,
} from "@/lib/admin/adminSession";
import {
  adminApiFetch,
  deleteAdminBooking,
  getAdminTenantId,
  postAdminBooking,
} from "./adminApi";
import { bosoHover, bosoLeave } from "./adminTooltip";
import { closeCustomSelectsOnOutsideClick, selectOption, setBookingSourceDefault, setBookingSourceFromSaved, selectDayChip, selectPeriodChip, toggleAllDiscRooms, toggleAllRoomsChip, toggleCustomSelect, toggleSingleDiscRoom, toggleSingleRoomChip } from "./adminUiHelpers";
import {
  attachScreenshotsToPayload,
  buildPayloadForServer,
  buildBookingRecordFromSave,
  collectBookingFromForm,
  handleSaveApiErrors,
  isBookingSaveSuccessful,
} from "./bookingForm";
import { showToast as toastImpl } from "./adminGlobals";
import {
  captureCleaningCard,
  capturePaymentCard,
  capturePremiumCard,
  type PaymentCardInfo,
} from "./bookingScreenshots";
import type { AdminInitResponse, AdminViewName, BookingRecord, RoomConfig } from "./types";
import type { AdminUndoApi } from "@/components/admin/undo/useAdminUndo";

export type AdminUiBridgeDeps = {
  activeView: AdminViewName;
  bookings: BookingRecord[];
  setBookings: React.Dispatch<React.SetStateAction<BookingRecord[]>>;
  applyServerData: (data: AdminInitResponse, options?: { silent?: boolean }) => void;
  silentSync: () => Promise<void>;
  switchView: (view: AdminViewName) => void;
  signOut?: () => Promise<void>;
  adminUndo?: AdminUndoApi;
};

export function useAdminUiBridge(deps: AdminUiBridgeDeps) {
  const editingRowRef = useRef<number | string | null>(null);
  const earlyTimeRef = useRef<string | null>(null);
  const lateTimeRef = useRef<string | null>(null);
  const isGridDraggingRef = useRef(false);
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const w = window as Window & {
      editingRowNumber?: number | string | null;
      selectedEarlyTime?: string | null;
      selectedLateTime?: string | null;
      isGridDragging?: boolean;
      API_URL?: string;
      BosoAuth?: {
        apiFetch: typeof adminApiFetch;
        parseApiJson: (r: Response) => Promise<unknown>;
        handleApiAuthError: (data: unknown) => boolean;
        isAuthenticated: () => boolean;
        bootstrap: (cb: () => void) => void;
        logout: () => void;
      };
    };

    w.API_URL = "/api/core";
    w.editingRowNumber = editingRowRef.current;
    w.selectedEarlyTime = earlyTimeRef.current;
    w.selectedLateTime = lateTimeRef.current;
    w.isGridDragging = isGridDraggingRef.current;

    w.showToast = toastImpl;
    w.closeDrawer = closeDrawer;
    w.bosoHover = (el: HTMLElement, row: string | number, type?: string) =>
      bosoHover(el, row, (type as "main" | "early" | "late") || "main");
    w.bosoLeave = bosoLeave;

    w.toggleCustomSelect = toggleCustomSelect;
    w.selectOption = selectOption;
    w.setBookingSourceDefault = setBookingSourceDefault;
    w.setBookingSourceFromSaved = setBookingSourceFromSaved;
    w.toggleAllRoomsChip = toggleAllRoomsChip;
    w.toggleSingleRoomChip = toggleSingleRoomChip;
    w.selectDayChip = selectDayChip;
    w.selectPeriodChip = selectPeriodChip;
    w.toggleAllDiscRooms = toggleAllDiscRooms;
    w.toggleSingleDiscRoom = toggleSingleDiscRoom;

    w.capturePremiumCard = capturePremiumCard;
    w.captureCleaningCard = captureCleaningCard;
    w.capturePaymentCard = capturePaymentCard;
    w.captureFinanceReportCard = w.captureFinanceReportCard || (async () => null);

    w.BosoAuth = {
      apiFetch: adminApiFetch,
      parseApiJson: async (res: Response) => res.json(),
      handleApiAuthError: (data: unknown) => {
        const d = data as { error?: string };
        return d?.error === "UNAUTHORIZED";
      },
      isAuthenticated: () => true,
      bootstrap: (callback: () => void) => {
        callback();
      },
      logout: () => {
        void deps.signOut?.();
      },
    };

    const form = document.getElementById("adminBookingForm");
    const onSubmit = (e: Event) => {
      void handleBookingSubmit(e);
    };
    form?.addEventListener("submit", onSubmit);
    document.addEventListener("click", closeCustomSelectsOnOutsideClick);

    Object.defineProperty(w, "editingRowNumber", {
      get: () => editingRowRef.current,
      set: (v) => {
        editingRowRef.current = v;
      },
      configurable: true,
    });
    Object.defineProperty(w, "selectedEarlyTime", {
      get: () => earlyTimeRef.current,
      set: (v) => {
        earlyTimeRef.current = v;
      },
      configurable: true,
    });
    Object.defineProperty(w, "selectedLateTime", {
      get: () => lateTimeRef.current,
      set: (v) => {
        lateTimeRef.current = v;
      },
      configurable: true,
    });

    return () => {
      form?.removeEventListener("submit", onSubmit);
      document.removeEventListener("click", closeCustomSelectsOnOutsideClick);
    };
  }, [deps.signOut]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.deleteCurrentBooking = deleteCurrentBooking;
  });

  useEffect(() => {
    bosoLeave();
  }, [deps.activeView]);

  function closeDrawer(): void {
    window.closeDrawer?.();
    document.getElementById("bookingDrawer")?.classList.remove("active");
  }

  function deleteCurrentBooking(): void {
    if (!editingRowRef.current) {
      toastImpl("Бронь не знайдено");
      return;
    }
    if (!window.openCustomConfirm) {
      toastImpl("Помилка інтерфейсу. Перезавантажте сторінку.");
      return;
    }
    window.openCustomConfirm(
      "Видалити бронювання?",
      "Цю дію неможливо скасувати. Бронь буде назавжди видалена з бази даних.",
      () => {
        void confirmDeleteBooking();
      }
    );
  }

  async function confirmDeleteBooking(): Promise<void> {
    window.closeCustomConfirm?.();
    const bookingKey = editingRowRef.current;
    if (bookingKey == null) return;

    const { bookings, setBookings, silentSync } = depsRef.current;
    const bookingToDelete =
      bookings.find((b) => String(b.id) === String(bookingKey)) ??
      bookings.find((b) => String(b.row) === String(bookingKey));
    if (!bookingToDelete) {
      toastImpl("Бронь не знайдено");
      return;
    }

    const rowToDelete = bookingToDelete.row;
    const undoId = depsRef.current.adminUndo?.recordBookingDelete(bookingToDelete);
    setBookings((prev) => {
      const next = prev.filter(
        (b) =>
          String(b.id) !== String(bookingToDelete.id) &&
          String(b.row) !== String(bookingToDelete.row)
      );
      window.allBookings = next;
      return next;
    });

    const btn = document.getElementById("adminDeleteBtn") as HTMLButtonElement | null;
    const originalHtml = btn?.innerHTML || "";
    if (btn) {
      btn.innerHTML = "Видал...";
      btn.disabled = true;
    }

    editingRowRef.current = null;
    closeDrawer();
    toastImpl("Успішно видалено");

    try {
      await deleteAdminBooking({
        row: rowToDelete,
        id:
          bookingToDelete.id != null && String(bookingToDelete.id).trim()
            ? String(bookingToDelete.id)
            : undefined,
      });
      await silentSync();
    } catch (err) {
      if (isAdminUnauthorizedError(err)) {
        await expireAdminSession();
        return;
      }
      depsRef.current.adminUndo?.cancelUndoEntry(undoId);
      setBookings((prev) => {
        const exists = prev.some(
          (b) =>
            String(b.id) === String(bookingToDelete.id) ||
            String(b.row) === String(bookingToDelete.row)
        );
        if (exists) return prev;
        const next = [...prev, bookingToDelete];
        window.allBookings = next;
        return next;
      });
      toastImpl("Помилка синхронізації!");
    } finally {
      if (btn) {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
      }
    }
  }

  function applyOptimisticBookingSave(
    bookingData: Record<string, unknown>,
    saveResult: { orderId?: string }
  ): void {
    const { bookings, setBookings } = depsRef.current;
    const record = buildBookingRecordFromSave(
      bookingData,
      saveResult,
      bookings,
      editingRowRef.current
    );
    const editingKey =
      editingRowRef.current != null ? String(editingRowRef.current).trim() : "";

    setBookings((prev) => {
      let next: BookingRecord[];
      if (editingKey) {
        const idx = prev.findIndex(
          (b) => String(b.id) === editingKey || String(b.row) === editingKey
        );
        if (idx >= 0) {
          next = prev.slice();
          next[idx] = { ...prev[idx], ...record, row: prev[idx].row, id: record.id };
        } else {
          next = [...prev, record];
        }
      } else {
        next = [...prev, record];
      }
      window.allBookings = next;
      return next;
    });
  }

  async function handleBookingSubmit(e: Event): Promise<void> {
    e.preventDefault();
    const btn = document.getElementById("adminSubmitBtn") as HTMLButtonElement | null;
    const originalText = btn?.innerText || "Зберегти";
    if (btn) {
      btn.innerText = "Збереження...";
      btn.disabled = true;
    }

    try {
      const formDates = (
        window as Window & { __bookingFormDates?: { checkIn: string; checkOut: string } }
      ).__bookingFormDates;
      const bookingData = collectBookingFromForm(
        editingRowRef.current,
        earlyTimeRef.current,
        lateTimeRef.current,
        formDates
      );
      if (!bookingData.checkIn || !bookingData.checkOut) {
        toastImpl("Оберіть дату заїзду та виїзду");
        return;
      }
      if (
        bookingData.assignmentState !== "holding" &&
        !String(bookingData.cottage || "").trim()
      ) {
        toastImpl("Оберіть котедж або додайте його в Налаштування → Котеджі");
        return;
      }
      if (!getAdminTenantId()) {
        toastImpl("Сесія комплексу не готова. Перезавантажте сторінку.");
        return;
      }

      const editingKey =
        editingRowRef.current != null ? String(editingRowRef.current).trim() : "";
      const previousBooking = editingKey
        ? (depsRef.current.bookings.find(
            (b) => String(b.id) === editingKey || String(b.row) === editingKey
          ) ?? null)
        : null;
      const previousSnapshot = previousBooking ? { ...previousBooking } : null;

      const payload = buildPayloadForServer(bookingData, editingRowRef.current);
      await attachScreenshotsToPayload(payload, bookingData);

      const json = await postAdminBooking(payload);
      handleSaveApiErrors(json);

      if (!isBookingSaveSuccessful(json)) {
        toastImpl("Бронь не збережено в базу");
        await depsRef.current.silentSync();
        return;
      }

      flushSync(() => {
        applyOptimisticBookingSave(bookingData, json);
      });
      const savedRecord = buildBookingRecordFromSave(
        bookingData,
        json,
        depsRef.current.bookings,
        editingRowRef.current
      );
      depsRef.current.adminUndo?.recordBookingSave(previousSnapshot, savedRecord);
      closeDrawer();
      toastImpl("Збережено!");
    } catch (err) {
      if (isAdminUnauthorizedError(err)) {
        await expireAdminSession();
        return;
      }
      toastImpl("Помилка синхронізації!");
    } finally {
      if (btn) {
        btn.innerText = originalText;
        btn.disabled = false;
      }
    }
  }

  return {
    editingRowRef,
    earlyTimeRef,
    lateTimeRef,
  };
}

declare global {
  interface Window {
    editingRowNumber?: number | string | null;
    selectedEarlyTime?: string | null;
    selectedLateTime?: string | null;
    isGridDragging?: boolean;
    closeDrawer?: () => void;
    bosoHover?: (el: HTMLElement, row: string | number, type?: string) => void;
    bosoLeave?: () => void;
    toggleCustomSelect?: (id: string) => void;
    selectOption?: (
      wrapperId: string,
      inputId: string,
      value: string,
      el?: HTMLElement | null,
      display?: string | null
    ) => void;
    setBookingSourceDefault?: () => void;
    setBookingSourceFromSaved?: (src: string) => void;
    toggleAllRoomsChip?: () => void;
    toggleSingleRoomChip?: (el: HTMLElement) => void;
    selectDayChip?: (el: HTMLElement) => void;
    selectPeriodChip?: (el: HTMLElement) => void;
    toggleAllDiscRooms?: () => void;
    toggleSingleDiscRoom?: (el: HTMLElement) => void;
    capturePremiumCard?: (b: BookingRecord, roomsList?: RoomConfig[]) => Promise<string | null>;
    captureCleaningCard?: (b: BookingRecord) => Promise<string | null>;
    capturePaymentCard?: (
      b: BookingRecord,
      info?: PaymentCardInfo
    ) => Promise<string | null>;
    captureFinanceReportCard?: (r: unknown) => Promise<string | null>;
    deleteCurrentBooking?: () => void;
    openCustomConfirm?: (title: string, desc: string, action: () => void) => void;
    closeCustomConfirm?: () => void;
    updatePricePreview?: () => void;
    BosoAuth?: {
      apiFetch: typeof adminApiFetch;
      parseApiJson: (r: Response) => Promise<unknown>;
      handleApiAuthError: (data: unknown) => boolean;
      isAuthenticated: () => boolean;
      bootstrap: (cb: () => void) => void;
      logout: () => void;
    };
  }
}
