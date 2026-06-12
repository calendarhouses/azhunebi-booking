"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadRoomPhotos } from "@/utils/roomPhotoStorage";
import {
  expireAdminSession,
  isAdminUnauthorizedError,
} from "@/lib/admin/adminSession";
import { getAdminTenantId, saveAdminSettings, type SaveAdminSettingsOptions } from "./adminApi";
import { showToast, showPublishingToast, syncLegacyGlobals } from "./adminGlobals";
import { dateWord, dayWord, selectedDatesPhrase } from "./adminPlural";
import { formatDateKey } from "./bookingUtils";
import { isPriceWeekend } from "./settings/restrictionGridUtils";
import type { RestrictionSelection } from "./settings/restrictionGridUtils";
import {
  buildCustomServiceForm,
  buildDiscountForm,
  buildRestrictionForm,
  buildRoomForm,
  buildTransactionForm,
  genericModalTitle,
  type CustomServiceFormState,
  type DiscountFormState,
  type GenericModalType,
  type PendingRestrictionModal,
  type PriceFormState,
  type RestrictionFormState,
  type RoomFormState,
  type SysServiceFormState,
  type TransactionFormState,
} from "./settings/GenericModalContent";
import {
  applyPriceFormToSettings,
  buildPriceForm,
  patchSingleCustomPrice,
  type PriceConstructorPreset,
} from "./settings/priceConstructorLogic";
import { createDraftRoomConfig, isRoomDraftId } from "@/lib/admin/roomDraft";
import { createDraftDiscount, dedupeDiscountsList, isDiscountDraftId } from "@/lib/admin/discountDraft";
import { resolveDiscountActive } from "./settings/discountConfig";
import { markDiscountDeleted, unmarkDiscountDeleted } from "@/lib/admin/discountPendingDeletes";
import { applyPublishingAvailability, formatPublishingErrorMessage, validatePublishing } from "@/lib/admin/validatePublishing";
import { createDefaultRoomConfig } from "../rooms/roomSettingsSteps";
import { getRoomAvailabilityStatus, patchFromAvailabilityStatus } from "./settings/roomAvailability";
import type { AdminSettingsPayload, BookingRecord, DiscountConfig, DiscountKind, RoomConfig, SettingsTabName } from "./types";

function persistKeysForEditType(
  type: GenericModalType | "service" | string
): Array<keyof AdminSettingsPayload> | undefined {
  switch (type) {
    case "room":
      return ["roomsList"];
    case "discount":
      return ["discountsList"];
    case "customService":
    case "service":
      return ["customServicesList"];
    case "sysService":
      return ["sysServicesList"];
    case "restriction":
      return ["restrictions"];
    case "transaction":
      return ["transactions"];
    case "price":
      return ["customPrices"];
    default:
      return undefined;
  }
}

function isExplicitStatusPatch(patch: Partial<RoomConfig>): boolean {
  const keys = Object.keys(patch);
  return keys.length > 0 && keys.every((k) => k === "availabilityStatus" || k === "active");
}

export type RoomAccordionKey = number;
export type DiscountAccordionKey = number;

export type UseAdminModalsOptions = {
  settings: AdminSettingsPayload;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettingsPayload>>;
  bookings: BookingRecord[];
  settingsTab?: SettingsTabName;
  priceTimelineBaseDateRef?: React.MutableRefObject<Date>;
  restrictionsTimelineBaseDateRef?: React.MutableRefObject<Date>;
  onRestrictionSelectionChange?: (sel: RestrictionSelection) => void;
  onAfterSettingsSave?: () => void;
};

export type RoomDrawerTab = "main" | "amenities";

export type PersistSettingsOptions = SaveAdminSettingsOptions & {
  /** Оновити UI одразу; запис на сервер у фоні */
  background?: boolean;
};

export function useAdminModals({
  settings,
  setSettings,
  bookings,
  settingsTab,
  priceTimelineBaseDateRef,
  restrictionsTimelineBaseDateRef,
  onRestrictionSelectionChange,
  onAfterSettingsSave,
}: UseAdminModalsOptions) {
  const [genericOpen, setGenericOpen] = useState(false);
  const [priceDrawerOpen, setPriceDrawerOpen] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [editType, setEditType] = useState<GenericModalType>("room");
  const [editId, setEditId] = useState<number | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");
  const confirmActionRef = useRef<(() => void | Promise<void>) | null>(null);

  const [restrictionSelection, setRestrictionSelection] = useState<RestrictionSelection>(null);
  const pendingRestrictionRef = useRef<PendingRestrictionModal>(null);

  const [roomForm, setRoomForm] = useState<RoomFormState>(buildRoomForm({}));
  const [priceForm, setPriceForm] = useState<PriceFormState>(() =>
    buildPriceForm(priceTimelineBaseDateRef?.current)
  );
  const [restrictionForm, setRestrictionForm] = useState<RestrictionFormState>(
    buildRestrictionForm(null)
  );
  const [discountForm, setDiscountForm] = useState<DiscountFormState>(
    buildDiscountForm({}, null)
  );
  const [customServiceForm, setCustomServiceForm] = useState<CustomServiceFormState>(
    buildCustomServiceForm({})
  );
  const [sysServiceForm, setSysServiceForm] = useState<SysServiceFormState>({
    name: "",
    price: "0",
    active: true,
  });
  const [transactionForm, setTransactionForm] = useState<TransactionFormState>(
    buildTransactionForm({})
  );
  const [roomPhotosBusy, setRoomPhotosBusy] = useState(false);
  const [roomDrawerOpen, setRoomDrawerOpen] = useState(false);
  const [roomDrawerId, setRoomDrawerId] = useState<number | null>(null);
  const [roomDrawerInitialTab, setRoomDrawerInitialTab] = useState<RoomDrawerTab>("main");
  const [roomDrawerLoading, setRoomDrawerLoading] = useState(false);
  const [roomAccordionKey, setRoomAccordionKey] = useState<RoomAccordionKey | null>(null);
  const [discountAccordionKey, setDiscountAccordionKey] = useState<DiscountAccordionKey | null>(null);
  const [discountAccordionScrollSeq, setDiscountAccordionScrollSeq] = useState(0);
  const [discountTemplatesOpen, setDiscountTemplatesOpen] = useState(false);
  const roomDrawerLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quickEditSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef(settings);
  const persistTailRef = useRef(Promise.resolve());
  settingsRef.current = settings;

  const mergeRoomPatch = useCallback((room: RoomConfig, patch: Partial<RoomConfig>): RoomConfig => {
    if (isExplicitStatusPatch(patch)) {
      const next: RoomConfig = { ...room, ...patch };
      if (patch.availabilityStatus !== undefined) {
        Object.assign(
          next,
          patchFromAvailabilityStatus(patch.availabilityStatus as "enabled" | "disabled")
        );
      }
      return next;
    }

    const next: RoomConfig = { ...room, ...patch };
    if (patch.name !== undefined) {
      next.short = patch.name;
    }
    return applyPublishingAvailability(next);
  }, []);

  const updateRestrictionSelection = useCallback(
    (sel: RestrictionSelection) => {
      setRestrictionSelection(sel);
      onRestrictionSelectionChange?.(sel);
    },
    [onRestrictionSelectionChange]
  );

  const persistSettings = useCallback(
    async (next: AdminSettingsPayload, options?: PersistSettingsOptions) => {
      settingsRef.current = next;
      setSettings(next);
      syncLegacyGlobals({ bookings, settings: next });

      const run = persistTailRef.current.then(async () => {
        const payload = settingsRef.current;
        try {
          await saveAdminSettings(payload, { keys: options?.keys });
          onAfterSettingsSave?.();
        } catch (e) {
          if (isAdminUnauthorizedError(e)) {
            await expireAdminSession();
            return;
          }
          if (options?.background) {
            showToast(
              e instanceof Error ? e.message : "Не вдалося зберегти на сервері"
            );
          }
          throw e;
        }
      });

      persistTailRef.current = run.catch(() => undefined);

      if (options?.background) {
        void run;
        return;
      }
      await run;
    },
    [bookings, setSettings, onAfterSettingsSave]
  );

  const flushQuickEditSave = useCallback(
    async (
      next: AdminSettingsPayload,
      keys?: Array<keyof AdminSettingsPayload>
    ) => {
      try {
        await saveAdminSettings(next, { keys });
        onAfterSettingsSave?.();
      } catch (e) {
        if (isAdminUnauthorizedError(e)) {
          await expireAdminSession();
          return;
        }
        console.error("Quick edit save:", e);
        showToast(e instanceof Error ? e.message : "Не вдалося зберегти");
      }
    },
    [onAfterSettingsSave]
  );

  const patchRoomQuickEdit = useCallback(
    (roomId: number, patch: Partial<RoomConfig>, options?: { debounceMs?: number }) => {
      const prev = settingsRef.current;
      const room = (prev.roomsList || []).find((r) => r.id === roomId);
      if (!room) return;

      if (isExplicitStatusPatch(patch)) {
        const enabling =
          patch.availabilityStatus === "enabled" ||
          (patch.active === true && getRoomAvailabilityStatus(room) !== "enabled");
        if (enabling) {
          const projected = mergeRoomPatch(room, patch);
          const result = validatePublishing(projected);
          if (!result.ok) {
            showPublishingToast(formatPublishingErrorMessage(result.missing));
            return;
          }
        }
      }

      const roomsList = (prev.roomsList || []).map((r) =>
        r.id === roomId ? mergeRoomPatch(r, patch) : r
      );
      const next: AdminSettingsPayload = { ...prev, roomsList };
      settingsRef.current = next;
      setSettings(next);
      syncLegacyGlobals({ bookings, settings: next });

      if (isRoomDraftId(roomId)) return;

      const scheduleSave = () => {
        void flushQuickEditSave(settingsRef.current, ["roomsList"]);
      };

      if (options?.debounceMs != null && options.debounceMs > 0) {
        if (quickEditSaveTimerRef.current) clearTimeout(quickEditSaveTimerRef.current);
        quickEditSaveTimerRef.current = setTimeout(() => {
          quickEditSaveTimerRef.current = null;
          scheduleSave();
        }, options.debounceMs);
        return;
      }

      if (quickEditSaveTimerRef.current) {
        clearTimeout(quickEditSaveTimerRef.current);
        quickEditSaveTimerRef.current = null;
      }
      scheduleSave();
    },
    [bookings, flushQuickEditSave, mergeRoomPatch, setSettings]
  );

  const openCustomConfirm = useCallback(
    (title: string, desc: string, action: () => void | Promise<void>) => {
      setConfirmTitle(title);
      setConfirmDesc(desc);
      confirmActionRef.current = action;
      setConfirmOpen(true);
    },
    []
  );

  const closeCustomConfirm = useCallback(() => {
    setConfirmOpen(false);
    confirmActionRef.current = null;
  }, []);

  const runConfirmAction = useCallback(async () => {
    const fn = confirmActionRef.current;
    if (fn) await fn();
  }, []);

  const clearRestrictionSelection = useCallback(() => {
    updateRestrictionSelection(null);
  }, [updateRestrictionSelection]);

  const openPriceConstructor = useCallback(
    (preset?: PriceConstructorPreset) => {
      const base = priceTimelineBaseDateRef?.current || new Date();
      setPriceForm(buildPriceForm(base, preset));
      setPriceDrawerOpen(true);
    },
    [priceTimelineBaseDateRef]
  );

  const closePriceConstructor = useCallback(() => {
    setPriceDrawerOpen(false);
  }, []);

  const openGenericModal = useCallback(
    (type: GenericModalType, id: number | null = null) => {
      if (type === "price") {
        openPriceConstructor();
        return;
      }
      setEditType(type);
      setEditId(id);
      const rooms = settings.roomsList || [];
      const discounts = settings.discountsList || [];
      const customServices = settings.customServicesList || [];
      const sysServices = settings.sysServicesList || [];
      const transactions = settings.transactions || [];

      if (type === "restriction") {
        const pre = pendingRestrictionRef.current;
        setRestrictionForm(buildRestrictionForm(pre));
        pendingRestrictionRef.current = null;
      } else if (type === "discount") {
        const d = id ? discounts.find((x) => x.id === id) : undefined;
        setDiscountForm(buildDiscountForm(d || {}, id));
      } else if (type === "customService") {
        const s = id ? customServices.find((x) => x.id === id) : undefined;
        setCustomServiceForm(buildCustomServiceForm(s || {}));
      } else if (type === "sysService" && id) {
        const ss = sysServices.find((x) => x.id === id);
        setSysServiceForm({
          name: ss?.name || "",
          price: String(ss?.price ?? 0),
          active: ss?.active !== false,
        });
      } else if (type === "transaction") {
        const t = id ? transactions.find((x) => x.id === id) : undefined;
        setTransactionForm(buildTransactionForm(t || {}));
      }
      setGenericOpen(true);
    },
    [settings, openPriceConstructor]
  );

  const openRoomAccordion = useCallback((key: RoomAccordionKey) => {
    setRoomAccordionKey(key);
  }, []);

  const closeRoomAccordion = useCallback(() => {
    setRoomAccordionKey(null);
  }, []);

  const toggleRoomAccordion = useCallback((roomId: number) => {
    setRoomAccordionKey((prev) => (prev === roomId ? null : roomId));
  }, []);

  const addRoomDraft = useCallback(() => {
    const prev = settingsRef.current;
    const existing = (prev.roomsList || []).find((r) => isRoomDraftId(r.id));
    if (existing) {
      setRoomAccordionKey(existing.id);
      return;
    }
    const draft = createDraftRoomConfig();
    const next: AdminSettingsPayload = {
      ...prev,
      roomsList: [...(prev.roomsList || []), draft],
    };
    settingsRef.current = next;
    setSettings(next);
    syncLegacyGlobals({ bookings, settings: next });
    setRoomAccordionKey(draft.id);
  }, [bookings, setSettings]);

  const discardRoomDraft = useCallback(
    (roomId: number) => {
      if (!isRoomDraftId(roomId)) return;
      const prev = settingsRef.current;
      const next: AdminSettingsPayload = {
        ...prev,
        roomsList: (prev.roomsList || []).filter((r) => r.id !== roomId),
      };
      settingsRef.current = next;
      setSettings(next);
      syncLegacyGlobals({ bookings, settings: next });
      closeRoomAccordion();
    },
    [bookings, closeRoomAccordion, setSettings]
  );

  const saveRoomSettings = useCallback(
    async (roomKey: RoomAccordionKey, patch: Partial<RoomConfig>) => {
      const snapshot = settingsRef.current;
      const rooms = [...(snapshot.roomsList || [])];
      let resolvedId: number;

      if (isRoomDraftId(roomKey)) {
        const maxId = rooms
          .filter((r) => !isRoomDraftId(r.id))
          .reduce((acc, r) => Math.max(acc, Number(r.id) || 0), 0);
        resolvedId = maxId + 1;
        const savedRoom = applyPublishingAvailability(
          createDefaultRoomConfig(resolvedId, patch)
        );
        const nextRooms = rooms.filter((r) => r.id !== roomKey);
        nextRooms.push(savedRoom);
        await persistSettings({ ...snapshot, roomsList: nextRooms }, {
          keys: ["roomsList"],
          background: true,
        });
        settingsRef.current = { ...snapshot, roomsList: nextRooms };
        setRoomAccordionKey(resolvedId);
        return resolvedId;
      }

      resolvedId = roomKey;
      const idx = rooms.findIndex((r) => r.id === roomKey);
      if (idx >= 0) {
        rooms[idx] = mergeRoomPatch(rooms[idx], patch);
      } else {
        rooms.push(createDefaultRoomConfig(roomKey, patch));
      }

      await persistSettings({ ...snapshot, roomsList: rooms }, {
        keys: ["roomsList"],
        background: true,
      });
      return resolvedId;
    },
    [mergeRoomPatch, persistSettings]
  );

  const toggleDiscountAccordion = useCallback((discountId: number) => {
    setDiscountAccordionKey((prev) => (prev === discountId ? null : discountId));
  }, []);

  const closeDiscountAccordion = useCallback(() => {
    setDiscountAccordionKey(null);
  }, []);

  const toggleDiscountTemplates = useCallback(() => {
    setDiscountTemplatesOpen((open) => !open);
  }, []);

  useEffect(() => {
    if (discountAccordionKey == null) return;
    const exists = (settings.discountsList || []).some((d) => d.id === discountAccordionKey);
    if (!exists) {
      setDiscountAccordionKey(null);
    }
  }, [settings.discountsList, discountAccordionKey]);

  useEffect(() => {
    if ((settings.discountsList || []).length === 0) {
      setDiscountTemplatesOpen(false);
    }
  }, [settings.discountsList]);

  const addDiscountDraft = useCallback(
    (kind?: DiscountKind) => {
      const prev = settingsRef.current;
      const list = dedupeDiscountsList(prev.discountsList || []);
      const existing = list.find((d) => isDiscountDraftId(d.id));
      const saved = list.filter((d) => !isDiscountDraftId(d.id));

      const bumpScroll = () => {
        setDiscountAccordionScrollSeq((seq) => seq + 1);
      };

      if (existing) {
        const refreshed = { ...createDraftDiscount(kind ?? existing.kind), id: existing.id };
        const others = list.filter((d) => d.id !== existing.id);
        const next: AdminSettingsPayload = {
          ...prev,
          discountsList: dedupeDiscountsList([...others, refreshed]),
        };
        settingsRef.current = next;
        setSettings(next);
        syncLegacyGlobals({ bookings, settings: next });
        setDiscountAccordionKey(existing.id);
        bumpScroll();
        return;
      }

      const draft = createDraftDiscount(kind);
      const next: AdminSettingsPayload = {
        ...prev,
        discountsList: dedupeDiscountsList([...saved, draft]),
      };
      settingsRef.current = next;
      setSettings(next);
      syncLegacyGlobals({ bookings, settings: next });
      setDiscountAccordionKey(draft.id);
      bumpScroll();
    },
    [bookings, setSettings]
  );

  const discardDiscountDraft = useCallback(
    (discountId: number, options?: { skipClose?: boolean }) => {
      if (!isDiscountDraftId(discountId)) return;
      const prev = settingsRef.current;
      const next: AdminSettingsPayload = {
        ...prev,
        discountsList: (prev.discountsList || []).filter((d) => d.id !== discountId),
      };
      settingsRef.current = next;
      setSettings(next);
      syncLegacyGlobals({ bookings, settings: next });
      if (!options?.skipClose) {
        setDiscountAccordionKey((key) => (key === discountId ? null : key));
      }
    },
    [bookings, setSettings]
  );

  const saveDiscountSettings = useCallback(
    async (discountKey: number, patch: Omit<DiscountConfig, "id">) => {
      const snapshot = settingsRef.current;
      const discounts = [...(snapshot.discountsList || [])];
      let resolvedId: number;

      if (isDiscountDraftId(discountKey)) {
        const maxId = discounts
          .filter((d) => !isDiscountDraftId(d.id))
          .reduce((acc, d) => Math.max(acc, Number(d.id) || 0), 0);
        resolvedId = maxId + 1;
        const saved: DiscountConfig = { ...patch, id: resolvedId };
        const withoutDraft = discounts.filter((d) => d.id !== discountKey);
        const nextList = [...withoutDraft, saved];
        await persistSettings({ ...snapshot, discountsList: nextList }, {
          keys: ["discountsList"],
          background: true,
        });
        settingsRef.current = { ...snapshot, discountsList: nextList };
        setSettings({ ...snapshot, discountsList: nextList });
        setDiscountAccordionKey(null);
        return resolvedId;
      }

      resolvedId = discountKey;
      const idx = discounts.findIndex((d) => d.id === discountKey);
      if (idx >= 0) {
        discounts[idx] = { ...discounts[idx], ...patch, id: discountKey };
      } else {
        discounts.unshift({ ...patch, id: discountKey });
      }
      await persistSettings({ ...snapshot, discountsList: discounts }, {
        keys: ["discountsList"],
        background: true,
      });
      settingsRef.current = { ...snapshot, discountsList: discounts };
      setSettings({ ...snapshot, discountsList: discounts });
      return resolvedId;
    },
    [persistSettings, setSettings]
  );

  const patchDiscountQuick = useCallback(
    (discountId: number, patch: Partial<DiscountConfig>) => {
      setSettings((prev) => {
        const discounts = (prev.discountsList || []).map((d) =>
          d.id === discountId ? { ...d, ...patch } : d
        );
        const next: AdminSettingsPayload = { ...prev, discountsList: discounts };
        settingsRef.current = next;
        syncLegacyGlobals({ bookings, settings: next });
        return next;
      });

      if (quickEditSaveTimerRef.current) {
        clearTimeout(quickEditSaveTimerRef.current);
      }
      quickEditSaveTimerRef.current = setTimeout(() => {
        quickEditSaveTimerRef.current = null;
        void flushQuickEditSave(settingsRef.current, ["discountsList"]);
      }, 280);
    },
    [bookings, flushQuickEditSave, setSettings]
  );

  const toggleDiscountActive = useCallback(
    (discountId: number) => {
      setSettings((prev) => {
        const discounts = (prev.discountsList || []).map((d) => {
          if (d.id !== discountId) return d;
          const current = resolveDiscountActive(d, isDiscountDraftId(d.id));
          return { ...d, active: !current };
        });
        const next: AdminSettingsPayload = { ...prev, discountsList: discounts };
        settingsRef.current = next;
        syncLegacyGlobals({ bookings, settings: next });
        return next;
      });

      if (quickEditSaveTimerRef.current) {
        clearTimeout(quickEditSaveTimerRef.current);
      }
      quickEditSaveTimerRef.current = setTimeout(() => {
        quickEditSaveTimerRef.current = null;
        void flushQuickEditSave(settingsRef.current, ["discountsList"]);
      }, 280);
    },
    [bookings, flushQuickEditSave, setSettings]
  );

  const setRoomPhotos = useCallback(
    async (roomId: number, photos: string[]) => {
      const snapshot = settingsRef.current;
      const next: AdminSettingsPayload = {
        ...snapshot,
        roomsList: (snapshot.roomsList || []).map((r) =>
          r.id === roomId ? applyPublishingAvailability({ ...r, photos: [...photos] }) : r
        ),
      };
      await persistSettings(next, { keys: ["roomsList"], background: true });
    },
    [persistSettings]
  );

  const uploadPhotosForRoom = useCallback(
    async (roomId: number, fileList: FileList, options?: { silent?: boolean }): Promise<string[]> => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
      if (!files.length) {
        if (!options?.silent) showToast("Оберіть файли зображень");
        return [];
      }

      setRoomPhotosBusy(true);
      try {
        const urls = await uploadRoomPhotos(files, getAdminTenantId(), roomId);
        if (!urls.length) {
          if (!options?.silent) showToast("Не вдалося обробити жодне фото");
          return [];
        }
        const snapshot = settingsRef.current;
        const room = (snapshot.roomsList || []).find((r) => r.id === roomId);
        const mergedPhotos = [...(room?.photos || []), ...urls];
        const rooms = (snapshot.roomsList || []).map((r) =>
          r.id === roomId
            ? applyPublishingAvailability({ ...r, photos: mergedPhotos })
            : r
        );
        await persistSettings({ ...snapshot, roomsList: rooms }, {
          keys: ["roomsList"],
          background: true,
        });
        if (!options?.silent) showToast(`Завантажено ${urls.length} фото`);
        return urls;
      } catch (e) {
        console.error("Room photos upload:", e);
        showToast(e instanceof Error ? e.message : "Помилка завантаження фото");
        return [];
      } finally {
        setRoomPhotosBusy(false);
      }
    },
    [persistSettings]
  );

  const openRoomDrawer = useCallback(
    (id: number | null = null, options?: { tab?: RoomDrawerTab }) => {
      if (roomDrawerLoadTimerRef.current) {
        clearTimeout(roomDrawerLoadTimerRef.current);
      }
      const rooms = settings.roomsList || [];
      const room = id ? rooms.find((x) => x.id === id) : undefined;
      setRoomDrawerLoading(true);
      setRoomDrawerId(id);
      setRoomDrawerInitialTab(options?.tab ?? "main");
      setRoomForm(buildRoomForm(room || {}));
      setRoomDrawerOpen(true);
      roomDrawerLoadTimerRef.current = setTimeout(() => {
        setRoomDrawerLoading(false);
      }, 220);
    },
    [settings]
  );

  const closeGenericModal = useCallback(() => {
    if (editType === "restriction") {
      clearRestrictionSelection();
    }
    setGenericOpen(false);
  }, [editType, clearRestrictionSelection]);

  const closeRoomDrawer = useCallback(() => {
    if (roomDrawerLoadTimerRef.current) {
      clearTimeout(roomDrawerLoadTimerRef.current);
      roomDrawerLoadTimerRef.current = null;
    }
    setRoomDrawerLoading(false);
    setRoomDrawerInitialTab("main");
    setRoomDrawerOpen(false);
  }, []);

  const confirmClearPrices = useCallback(async () => {
    closeCustomConfirm();
    const next: AdminSettingsPayload = {
      ...settings,
      roomsList: (settings.roomsList || []).map((r) => ({
        ...r,
        priceWeekday: 0,
        priceWeekend: 0,
      })),
      customPrices: {},
    };
    await persistSettings(next, {
      keys: ["roomsList", "customPrices"],
      background: true,
    });
  }, [closeCustomConfirm, persistSettings, settings]);

  const clearPricesAlert = useCallback(() => {
    openCustomConfirm(
      "Видалити всі ціни?",
      "Ви впевнені, що хочете скинути всі налаштовані ціни? Цю дію неможливо скасувати.",
      () => void confirmClearPrices()
    );
  }, [openCustomConfirm, confirmClearPrices]);

  const confirmDeleteRestrictionSelection = useCallback(async () => {
    closeCustomConfirm();
    const sel = restrictionSelection;
    if (!sel?.roomId) return;
    const roomId = sel.roomId;
    const restrictions = { ...(settings.restrictions || {}) };
    if (restrictions[roomId]) {
      const roomRestr = { ...restrictions[roomId] };
      sel.dates.forEach((ds) => {
        delete roomRestr[ds];
      });
      if (Object.keys(roomRestr).length === 0) delete restrictions[roomId];
      else restrictions[roomId] = roomRestr;
    }
    updateRestrictionSelection(null);
    await persistSettings({ ...settings, restrictions }, {
      keys: ["restrictions"],
      background: true,
    });
  }, [closeCustomConfirm, restrictionSelection, settings, persistSettings, updateRestrictionSelection]);

  const confirmClearAllRestrictions = useCallback(async () => {
    closeCustomConfirm();
    updateRestrictionSelection(null);
    await persistSettings({ ...settings, restrictions: {} }, {
      keys: ["restrictions"],
      background: true,
    });
  }, [closeCustomConfirm, settings, persistSettings, updateRestrictionSelection]);

  const clearRestrictionsAlert = useCallback(() => {
    if (restrictionSelection?.dates?.length) {
      openCustomConfirm(
        "Видалити обмеження?",
        `Зняти обмеження з ${selectedDatesPhrase(restrictionSelection.dates.length)}?`,
        () => void confirmDeleteRestrictionSelection()
      );
    } else {
      openCustomConfirm(
        "Очистити всі обмеження?",
        "Ви впевнені? Усі мінімальні терміни перебування будуть видалені.",
        () => void confirmClearAllRestrictions()
      );
    }
  }, [
    restrictionSelection,
    openCustomConfirm,
    persistSettings,
    confirmDeleteRestrictionSelection,
    confirmClearAllRestrictions,
  ]);

  const openRestrictionConstructor = useCallback(() => {
    if (restrictionSelection?.dates?.length) {
      const sorted = [...restrictionSelection.dates].sort();
      const d1 = new Date(sorted[0]);
      const d2 = new Date(sorted[sorted.length - 1]);
      pendingRestrictionRef.current = {
        roomIds: [String(restrictionSelection.roomId)],
        useCustomRange: true,
        startDate: sorted[0],
        endDate: sorted[sorted.length - 1],
        rangeLabel: `${d1.toLocaleDateString("uk-UA", { day: "numeric", month: "short" })} — ${d2.toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" })} (${sorted.length} ${dayWord(sorted.length)})`,
        minNights: restrictionSelection.minN || 2,
      };
    } else {
      pendingRestrictionRef.current = null;
    }
    openGenericModal("restriction");
  }, [restrictionSelection, openGenericModal]);

  const confirmDeleteGenericItem = useCallback(
    async (type?: GenericModalType | "service" | string, id?: number | null) => {
      closeCustomConfirm();
      const resolvedType = (type === "service" ? "customService" : type) || editType;
      const resolvedId = id ?? editId;
      if (resolvedId == null && resolvedType !== "transaction") return;

      const snapshot = settingsRef.current;
      const next = { ...snapshot };

      if (resolvedType === "room") {
        next.roomsList = (snapshot.roomsList || []).filter(
          (r) => String(r.id) !== String(resolvedId)
        );
        closeRoomAccordion();
      } else if (resolvedType === "discount") {
        markDiscountDeleted(Number(resolvedId));
        next.discountsList = (snapshot.discountsList || []).filter(
          (d) => String(d.id) !== String(resolvedId)
        );
        setDiscountAccordionKey((key) =>
          key != null && String(key) === String(resolvedId) ? null : key
        );
        settingsRef.current = next;
        setSettings(next);
        syncLegacyGlobals({ bookings, settings: next });
      } else if (resolvedType === "customService" || type === "service") {
        next.customServicesList = (snapshot.customServicesList || []).filter(
          (s) => String(s.id) !== String(resolvedId)
        );
      } else if (resolvedType === "transaction" && resolvedId != null) {
        next.transactions = (snapshot.transactions || []).filter(
          (t) => String(t.id) !== String(resolvedId)
        );
      }

      try {
        const deleteKeys = persistKeysForEditType(resolvedType);
        await persistSettings(next, { keys: deleteKeys, background: true });
        setGenericOpen(false);
        showToast("Успішно видалено!");
      } catch {
        if (resolvedType === "discount" && resolvedId != null) {
          unmarkDiscountDeleted(Number(resolvedId));
          const deleted = snapshot.discountsList?.find(
            (d) => String(d.id) === String(resolvedId)
          );
          if (deleted) {
            const current = settingsRef.current;
            const alreadyPresent = (current.discountsList || []).some(
              (d) => String(d.id) === String(resolvedId)
            );
            if (!alreadyPresent) {
              const restored: AdminSettingsPayload = {
                ...current,
                discountsList: dedupeDiscountsList([deleted, ...(current.discountsList || [])]),
              };
              settingsRef.current = restored;
              setSettings(restored);
              syncLegacyGlobals({ bookings, settings: restored });
            }
          }
        }
        showToast("Не вдалося видалити");
      }
    },
    [bookings, closeCustomConfirm, closeDiscountAccordion, closeRoomAccordion, editType, editId, persistSettings, setSettings]
  );

  const confirmDeleteGenericItemRef = useRef(confirmDeleteGenericItem);
  confirmDeleteGenericItemRef.current = confirmDeleteGenericItem;

  const deleteGenericItem = useCallback(
    (type?: GenericModalType | "service" | string, id?: number | null) => {
      const resolvedType = (type === "service" ? "customService" : type) || editType;
      const resolvedId = id ?? editId;
      if (type && id !== undefined) {
        setEditType(resolvedType as GenericModalType);
        setEditId(resolvedId);
      }
      if (
        resolvedType === "room" &&
        typeof resolvedId === "number" &&
        isRoomDraftId(resolvedId)
      ) {
        discardRoomDraft(resolvedId);
        return;
      }
      if (resolvedType === "discount" && typeof resolvedId === "number" && isDiscountDraftId(resolvedId)) {
        discardDiscountDraft(resolvedId);
        return;
      }
      let itemType = "елемент";
      if (resolvedType === "room") itemType = "житло";
      if (resolvedType === "discount") itemType = "знижку";
      if (resolvedType === "customService" || type === "service") itemType = "послугу";
      if (resolvedType === "transaction") itemType = "транзакцію";
      openCustomConfirm(
        `Видалити ${itemType}?`,
        "Ви впевнені? Цю дію неможливо скасувати.",
        () => void confirmDeleteGenericItemRef.current(resolvedType, resolvedId)
      );
    },
    [discardDiscountDraft, discardRoomDraft, editType, editId, openCustomConfirm]
  );

  const saveRoomDrawer = useCallback(async () => {
    const rooms = [...(settings.roomsList || [])];
    const roomId = roomDrawerId ?? Date.now();
    const name = roomForm.name.trim();
    const basePatch: Omit<RoomConfig, "id"> = {
      name,
      short: name,
      desc: roomForm.desc,
      capacity: roomForm.capacity,
      maxCapacity: roomForm.maxCapacity,
      extraGuestPrice: roomForm.extraGuestPrice,
      priceWeekday: roomForm.priceWeekday,
      priceWeekend: roomForm.priceWeekend,
      active: roomForm.active,
      photos: roomForm.photos?.length ? [...roomForm.photos] : [],
      detailedDescription: roomForm.detailedDescription,
      rules: roomForm.rules,
      amenities: roomForm.amenities,
    };

    const idx = rooms.findIndex((x) => x.id === roomId);
    const mergedRoom = applyPublishingAvailability(
      idx >= 0
        ? { ...rooms[idx], ...basePatch }
        : { id: roomId, ...basePatch } as RoomConfig
    );

    if (idx >= 0) {
      rooms[idx] = mergedRoom;
    } else {
      rooms.push(mergedRoom);
    }

    const next: AdminSettingsPayload = { ...settings, roomsList: rooms };
    await persistSettings(next, { keys: ["roomsList"], background: true });
    setRoomDrawerOpen(false);
    showToast("Котедж збережено");
  }, [persistSettings, roomDrawerId, roomForm, settings]);

  const deleteRoomDrawer = useCallback(async () => {
    if (roomDrawerId == null) return;
    const next: AdminSettingsPayload = {
      ...settings,
      roomsList: (settings.roomsList || []).filter((r) => r.id !== roomDrawerId),
    };
    await persistSettings(next, { keys: ["roomsList"], background: true });
    setRoomDrawerOpen(false);
    showToast("Котедж видалено");
  }, [persistSettings, roomDrawerId, settings]);

  const savePriceConstructor = useCallback(async () => {
    const next = applyPriceFormToSettings(settings, priceForm);
    if (!next) {
      showToast("Вкажи ціну, житло, дні тижня та період");
      return;
    }
    setPriceSaving(true);
    try {
      await persistSettings(next, { keys: ["customPrices"], background: true });
      setPriceDrawerOpen(false);
      showToast("Ціни збережено");
    } finally {
      setPriceSaving(false);
    }
  }, [persistSettings, priceForm, settings]);

  const patchCustomPrice = useCallback(
    async (roomId: number | string, dateStr: string, amount: number) => {
      const next = patchSingleCustomPrice(settings, roomId, dateStr, amount);
      await persistSettings(next, { keys: ["customPrices"], background: true });
    },
    [persistSettings, settings]
  );

  const saveGenericModal = useCallback(async () => {
    let next = { ...settings };

    if (editType === "room") {
      const name = roomForm.name || "Новий котедж";
      const rooms = [...(settings.roomsList || [])];
      const roomPatch: Omit<RoomConfig, "id"> = {
        name,
        short: name,
        desc: roomForm.desc,
        capacity: roomForm.capacity,
        maxCapacity: roomForm.maxCapacity,
        extraGuestPrice: roomForm.extraGuestPrice,
        priceWeekday: roomForm.priceWeekday,
        priceWeekend: roomForm.priceWeekend,
        active: roomForm.active,
        photos: roomForm.photos?.length ? [...roomForm.photos] : [],
        detailedDescription: roomForm.detailedDescription,
        rules: roomForm.rules,
        amenities: roomForm.amenities,
      };
      if (editId) {
        const idx = rooms.findIndex((x) => x.id === editId);
        if (idx >= 0) {
          rooms[idx] = { ...rooms[idx], ...roomPatch };
        } else {
          rooms.push({
            id: editId,
            ...roomPatch,
          });
        }
      } else {
        rooms.push({
          id: Date.now(),
          ...roomPatch,
        });
      }
      next.roomsList = rooms;
    } else if (editType === "discount") {
      const days = discountForm.days || 2;
      const pct = discountForm.percent || 15;
      let savedIds: string[] = [];
      let displayRoomsText = "";
      if (discountForm.allSelected) {
        savedIds = ["all"];
        displayRoomsText = "Всі котеджі";
      } else {
        const names = (settings.roomsList || [])
          .filter((r) => discountForm.selectedIds.includes(String(r.id)))
          .map((r) => r.name);
        savedIds = discountForm.selectedIds;
        displayRoomsText = names.length > 0 ? names.join(", ") : "Не обрано";
      }
      const discounts = [...(settings.discountsList || [])];
      if (editId) {
        const d = discounts.find((x) => x.id === editId);
        if (d) {
          d.condition = `Діб в бронюванні: ${days}`;
          d.discount = `${pct}%`;
          d.roomsIds = savedIds;
          d.rooms = displayRoomsText;
        }
      } else {
        discounts.push({
          id: Date.now(),
          condition: `Діб в бронюванні: ${days}`,
          discount: `${pct}%`,
          roomsIds: savedIds,
          rooms: displayRoomsText,
        });
      }
      next.discountsList = discounts;
    } else if (editType === "customService") {
      const services = [...(settings.customServicesList || [])];
      if (editId) {
        const s = services.find((x) => x.id === editId);
        if (s) {
          s.name = customServiceForm.name || "Нова послуга";
          s.price = parseInt(customServiceForm.price, 10) || 0;
          s.perDay = customServiceForm.perDay;
          s.perGuest = customServiceForm.perGuest;
          s.active = customServiceForm.active;
        }
      } else {
        services.push({
          id: Date.now(),
          name: customServiceForm.name || "Нова послуга",
          price: parseInt(customServiceForm.price, 10) || 0,
          perDay: customServiceForm.perDay,
          perGuest: customServiceForm.perGuest,
          rooms: "Всі",
          active: customServiceForm.active,
        });
      }
      next.customServicesList = services;
    } else if (editType === "sysService" && editId) {
      const services = [...(settings.sysServicesList || [])];
      const ss = services.find((x) => x.id === editId);
      if (ss) {
        ss.price = parseInt(sysServiceForm.price, 10) || 0;
        ss.active = sysServiceForm.active;
      }
      next.sysServicesList = services;
    } else if (editType === "restriction") {
      const selectedRooms = restrictionForm.allRoomsActive
        ? (settings.roomsList || []).filter((r) => r.active).map((r) => String(r.id))
        : restrictionForm.selectedRoomIds;
      const minNights = restrictionForm.minNights || 0;
      const dayType = restrictionForm.dayType;

      if (minNights < 1) {
        showToast("Вкажіть мінімум 1 добу");
        return;
      }
      if (selectedRooms.length === 0) {
        showToast("Оберіть хоча б один котедж");
        return;
      }

      const restrictions = { ...(settings.restrictions || {}) };
      const applyToDates = (roomId: string, start: Date | string, end: Date | string) => {
        if (!restrictions[roomId]) restrictions[roomId] = {};
        const d = new Date(start);
        const endD = new Date(end);
        while (d <= endD) {
          const isWeekend = isPriceWeekend(d);
          if (dayType === "weekdays" && isWeekend) {
            d.setDate(d.getDate() + 1);
            continue;
          }
          if (dayType === "weekends" && !isWeekend) {
            d.setDate(d.getDate() + 1);
            continue;
          }
          restrictions[roomId][formatDateKey(d)] = minNights;
          d.setDate(d.getDate() + 1);
        }
      };

      if (restrictionForm.useCustomRange) {
        if (!restrictionForm.startDate || !restrictionForm.endDate) {
          showToast("Немає обраного діапазону");
          return;
        }
        selectedRooms.forEach((rid) =>
          applyToDates(rid, restrictionForm.startDate, restrictionForm.endDate)
        );
      } else {
        const base = restrictionsTimelineBaseDateRef?.current || new Date();
        const startDate = new Date(base);
        startDate.setDate(1);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + (parseInt(restrictionForm.periodMonths, 10) || 1));
        endDate.setDate(endDate.getDate() - 1);
        selectedRooms.forEach((rid) => applyToDates(rid, startDate, endDate));
      }
      next.restrictions = restrictions;
      updateRestrictionSelection(null);
    } else if (editType === "transaction") {
      const tAmount = parseInt(transactionForm.amount, 10) || 0;
      if (tAmount <= 0) {
        showToast("Сума має бути більше нуля!");
        return;
      }
      const transactions = [...(settings.transactions || [])];
      if (editId) {
        const trans = transactions.find((x) => x.id === editId);
        if (trans) {
          trans.type = transactionForm.type;
          trans.category = transactionForm.category;
          trans.amount = tAmount;
          trans.date = transactionForm.date;
          trans.comment = transactionForm.comment;
        }
      } else {
        transactions.push({
          id: Date.now(),
          type: transactionForm.type,
          category: transactionForm.category,
          amount: tAmount,
          date: transactionForm.date,
          comment: transactionForm.comment,
        });
      }
      next.transactions = transactions;
    }

    await persistSettings(next, {
      keys: persistKeysForEditType(editType),
      background: true,
    });
    setGenericOpen(false);
    showToast("Збережено успішно!");
  }, [
    editType,
    editId,
    settings,
    roomForm,
    discountForm,
    customServiceForm,
    sysServiceForm,
    restrictionForm,
    transactionForm,
    restrictionsTimelineBaseDateRef,
    persistSettings,
    updateRestrictionSelection,
  ]);

  const upsertRoomInSettings = useCallback(
    (photos: string[]) => {
      if (roomDrawerId == null) return { ...settings };
      const name = roomForm.name || "Новий котедж";
      const rooms = [...(settings.roomsList || [])];
      const roomPatch: Omit<RoomConfig, "id" | "priceWeekday" | "priceWeekend"> = {
        name,
        short: name,
        desc: roomForm.desc,
        capacity: roomForm.capacity,
        maxCapacity: roomForm.maxCapacity,
        extraGuestPrice: roomForm.extraGuestPrice,
        active: roomForm.active,
        photos,
      };
      const idx = rooms.findIndex((x) => x.id === roomDrawerId);
      if (idx >= 0) {
        rooms[idx] = { ...rooms[idx], ...roomPatch };
      } else {
        rooms.push({
          id: roomDrawerId,
          ...roomPatch,
          priceWeekday: 4000,
          priceWeekend: 5000,
        });
      }
      return { ...settings, roomsList: rooms };
    },
    [roomDrawerId, roomForm, settings]
  );

  const handleRoomPhotosSelected = useCallback(
    async (fileList: FileList) => {
      if (!roomDrawerOpen || roomDrawerId == null) {
        showToast("Спочатку відкрийте форму котеджу");
        return;
      }
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
      if (!files.length) {
        showToast("Оберіть файли зображень");
        return;
      }

      setRoomPhotosBusy(true);
      try {
        const urls = await uploadRoomPhotos(files, getAdminTenantId(), roomDrawerId);
        if (!urls.length) {
          showToast("Не вдалося обробити жодне фото");
          return;
        }
        const photos = [...(roomForm.photos || []), ...urls];
        setRoomForm((f) => ({ ...f, photos }));
        const next = upsertRoomInSettings(photos);
        await persistSettings(next, { keys: ["roomsList"], background: true });
        showToast(`Завантажено ${urls.length} фото`);
      } catch (e) {
        console.error("Room photos upload:", e);
        showToast(e instanceof Error ? e.message : "Помилка завантаження фото");
      } finally {
        setRoomPhotosBusy(false);
      }
    },
    [roomDrawerOpen, roomDrawerId, roomForm.photos, upsertRoomInSettings, persistSettings]
  );

  const restrictionHint =
    restrictionSelection?.dates?.length
      ? (() => {
          const room = (settings.roomsList || []).find(
            (r) => String(r.id) === String(restrictionSelection.roomId)
          );
          const name = room ? room.name : "котедж";
          const n = restrictionSelection.dates.length;
          return `Обрано ${n} ${dateWord(n)} для «${name}». Натисніть «Конструктор обмежень» або «Видалити».`;
        })()
      : "";

  return {
    genericOpen,
    priceDrawerOpen,
    priceSaving,
    editType,
    editId,
    modalTitle: genericModalTitle(editType, editId),
    showDeleteBtn: editId != null && editType !== "price" && editType !== "restriction",
    openGenericModal,
    openPriceConstructor,
    closePriceConstructor,
    savePriceConstructor,
    patchCustomPrice,
    closeGenericModal,
    saveGenericModal,
    roomDrawerOpen,
    roomDrawerLoading,
    roomDrawerId,
    roomDrawerInitialTab,
    roomAccordionKey,
    openRoomAccordion,
    addRoomDraft,
    discardRoomDraft,
    closeRoomAccordion,
    toggleRoomAccordion,
    saveRoomSettings,
    discountAccordionKey,
    discountAccordionScrollSeq,
    discountTemplatesOpen,
    toggleDiscountTemplates,
    addDiscountDraft,
    discardDiscountDraft,
    closeDiscountAccordion,
    toggleDiscountAccordion,
    saveDiscountSettings,
    patchDiscountQuick,
    toggleDiscountActive,
    setRoomPhotos,
    uploadPhotosForRoom,
    openRoomDrawer,
    closeRoomDrawer,
    saveRoomDrawer,
    deleteRoomDrawer,
    deleteGenericItem,
    confirmDeleteGenericItem,
    confirmOpen,
    confirmTitle,
    confirmDesc,
    openCustomConfirm,
    persistSettings,
    patchRoomQuickEdit,
    closeCustomConfirm,
    runConfirmAction,
    clearPricesAlert,
    confirmClearPrices,
    clearRestrictionsAlert,
    openRestrictionConstructor,
    restrictionSelection,
    setRestrictionSelection: updateRestrictionSelection,
    restrictionHint,
    roomForm,
    setRoomForm,
    roomPhotosBusy,
    handleRoomPhotosSelected,
    priceForm,
    setPriceForm,
    restrictionForm,
    setRestrictionForm,
    discountForm,
    setDiscountForm,
    customServiceForm,
    setCustomServiceForm,
    sysServiceForm,
    setSysServiceForm,
    transactionForm,
    setTransactionForm,
    settingsTab,
  };
}

export type AdminModalsApi = ReturnType<typeof useAdminModals>;
