"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadRoomPhotos } from "@/utils/roomPhotoStorage";
import {
  expireAdminSession,
  isAdminUnauthorizedError,
} from "@/lib/admin/adminSession";
import { getAdminTenantId, saveAdminSettings, type SaveAdminSettingsOptions } from "./adminApi";
import { showToast, showPublishingToast, syncLegacyGlobals } from "./adminGlobals";
import {
  buildCustomServiceForm,
  buildDiscountForm,
  buildRoomForm,
  buildTransactionForm,
  genericModalTitle,
  type CustomServiceFormState,
  type DiscountFormState,
  type GenericModalType,
  type PriceFormState,
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
import {
  applyRuleFormToSettings,
  buildRuleForm,
  RULE_SETTINGS_KEYS,
  type RuleConstructorPreset,
  type RuleFormState,
} from "./settings/ruleConstructorLogic";
import { createDraftRoomConfig, isRoomDraftId } from "@/lib/admin/roomDraft";
import { createDraftDiscount, dedupeDiscountsList, isDiscountDraftId } from "@/lib/admin/discountDraft";
import { resolveDiscountActive } from "./settings/discountConfig";
import { markDiscountDeleted, unmarkDiscountDeleted } from "@/lib/admin/discountPendingDeletes";
import { applyPublishingAvailability, formatPublishingErrorMessage, validatePublishing } from "@/lib/admin/validatePublishing";
import { createDefaultRoomConfig } from "../rooms/roomSettingsSteps";
import { getRoomAvailabilityStatus, patchFromAvailabilityStatus } from "./settings/roomAvailability";
import type { AdminSettingsPayload, BookingRecord, DiscountConfig, DiscountKind, RoomConfig, SettingsTabName } from "./types";
import type { AdminUndoApi } from "@/components/admin/undo/useAdminUndo";

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
      return [...RULE_SETTINGS_KEYS];
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
  onAfterSettingsSave?: () => void;
  adminUndo?: AdminUndoApi;
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
  onAfterSettingsSave,
  adminUndo,
}: UseAdminModalsOptions) {
  const [genericOpen, setGenericOpen] = useState(false);
  const [priceDrawerOpen, setPriceDrawerOpen] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [ruleDrawerOpen, setRuleDrawerOpen] = useState(false);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [editType, setEditType] = useState<GenericModalType>("room");
  const [editId, setEditId] = useState<number | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmDesc, setConfirmDesc] = useState("");
  const confirmActionRef = useRef<(() => void | Promise<void>) | null>(null);

  const [roomForm, setRoomForm] = useState<RoomFormState>(buildRoomForm({}));
  const [priceForm, setPriceForm] = useState<PriceFormState>(() =>
    buildPriceForm(priceTimelineBaseDateRef?.current)
  );
  const [ruleForm, setRuleForm] = useState<RuleFormState>(() =>
    buildRuleForm(restrictionsTimelineBaseDateRef?.current)
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
  const roomQuickEditSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discountQuickEditSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (patch.availabilityStatus !== undefined) {
      Object.assign(
        next,
        patchFromAvailabilityStatus(patch.availabilityStatus as "enabled" | "disabled")
      );
    }
    if (!String(next.short || "").trim() && String(next.name || "").trim()) {
      next.short = next.name;
    }
    return applyPublishingAvailability(next);
  }, []);

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

      // Default debounce — rapid chip edits used to fire many identical TG “Збережено: Житло”.
      const debounceMs =
        options?.debounceMs != null && options.debounceMs >= 0 ? options.debounceMs : 450;

      const scheduleSave = () => {
        void flushQuickEditSave(settingsRef.current, ["roomsList"]);
      };

      if (debounceMs > 0) {
        if (roomQuickEditSaveTimerRef.current) clearTimeout(roomQuickEditSaveTimerRef.current);
        roomQuickEditSaveTimerRef.current = setTimeout(() => {
          roomQuickEditSaveTimerRef.current = null;
          scheduleSave();
        }, debounceMs);
        return;
      }

      if (roomQuickEditSaveTimerRef.current) {
        clearTimeout(roomQuickEditSaveTimerRef.current);
        roomQuickEditSaveTimerRef.current = null;
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

  const openRuleConstructor = useCallback(
    (preset?: RuleConstructorPreset) => {
      const base = restrictionsTimelineBaseDateRef?.current || new Date();
      setRuleForm(buildRuleForm(base, preset));
      setRuleDrawerOpen(true);
    },
    [restrictionsTimelineBaseDateRef]
  );

  const closeRuleConstructor = useCallback(() => {
    setRuleDrawerOpen(false);
  }, []);

  const openGenericModal = useCallback(
    (type: GenericModalType, id: number | null = null) => {
      if (type === "price") {
        openPriceConstructor();
        return;
      }
      if (type === "restriction") {
        openRuleConstructor();
        return;
      }
      setEditType(type);
      setEditId(id);
      const rooms = settings.roomsList || [];
      const discounts = settings.discountsList || [];
      const customServices = settings.customServicesList || [];
      const sysServices = settings.sysServicesList || [];
      const transactions = settings.transactions || [];

      if (type === "discount") {
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
        setTransactionForm(buildTransactionForm(t || {}, settings.customServicesList));
      }
      setGenericOpen(true);
    },
    [settings, openPriceConstructor, openRuleConstructor]
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

  const addRoomDraft = useCallback((): number => {
    const prev = settingsRef.current;
    const existing = (prev.roomsList || []).find((r) => isRoomDraftId(r.id));
    if (existing) {
      setRoomAccordionKey(existing.id);
      return existing.id;
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
    return draft.id;
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

      if (discountQuickEditSaveTimerRef.current) {
        clearTimeout(discountQuickEditSaveTimerRef.current);
      }
      discountQuickEditSaveTimerRef.current = setTimeout(() => {
        discountQuickEditSaveTimerRef.current = null;
        void flushQuickEditSave(settingsRef.current, ["discountsList"]);
      }, 280);
    },
    [bookings, flushQuickEditSave, setSettings]
  );

  const toggleDiscountActive = useCallback(
    (discountId: number) => {
      if (isDiscountDraftId(discountId)) return;
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

      if (discountQuickEditSaveTimerRef.current) {
        clearTimeout(discountQuickEditSaveTimerRef.current);
      }
      discountQuickEditSaveTimerRef.current = setTimeout(() => {
        discountQuickEditSaveTimerRef.current = null;
        void flushQuickEditSave(settingsRef.current, ["discountsList"]);
      }, 280);
    },
    [bookings, flushQuickEditSave, setSettings]
  );

  useEffect(() => {
    return () => {
      if (roomQuickEditSaveTimerRef.current) {
        clearTimeout(roomQuickEditSaveTimerRef.current);
        roomQuickEditSaveTimerRef.current = null;
        void flushQuickEditSave(settingsRef.current, ["roomsList"]);
      }
      if (discountQuickEditSaveTimerRef.current) {
        clearTimeout(discountQuickEditSaveTimerRef.current);
        discountQuickEditSaveTimerRef.current = null;
        void flushQuickEditSave(settingsRef.current, ["discountsList"]);
      }
    };
  }, [flushQuickEditSave]);

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
    setGenericOpen(false);
  }, []);

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
    adminUndo?.pushSettingsUndo(settingsRef.current, ["roomsList", "customPrices"]);
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
  }, [adminUndo, closeCustomConfirm, persistSettings, settings]);

  const clearPricesAlert = useCallback(() => {
    openCustomConfirm(
      "Видалити всі ціни?",
      "Ви впевнені, що хочете скинути всі налаштовані ціни? Цю дію неможливо скасувати.",
      () => void confirmClearPrices()
    );
  }, [openCustomConfirm, confirmClearPrices]);

  const confirmClearAllRules = useCallback(async () => {
    closeCustomConfirm();
    adminUndo?.pushSettingsUndo(settingsRef.current, [...RULE_SETTINGS_KEYS]);
    await persistSettings({ ...settings, restrictions: {}, closedDates: {} }, {
      keys: [...RULE_SETTINGS_KEYS],
      background: true,
    });
  }, [adminUndo, closeCustomConfirm, settings, persistSettings]);

  const clearRulesAlert = useCallback(() => {
    openCustomConfirm(
      "Видалити всі правила?",
      "Ви впевнені? Усі мінімальні ночі та закриті дати будуть видалені.",
      () => void confirmClearAllRules()
    );
  }, [openCustomConfirm, confirmClearAllRules]);

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
        closeRoomDrawer();
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
    [bookings, closeCustomConfirm, closeDiscountAccordion, closeRoomAccordion, closeRoomDrawer, editType, editId, persistSettings, setSettings]
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
    const short = roomForm.short.trim() || name;
    const basePatch: Omit<RoomConfig, "id"> = {
      name,
      short,
      desc: roomForm.desc,
      capacity: roomForm.capacity,
      maxCapacity: roomForm.maxCapacity,
      extraGuestPrice: roomForm.extraGuestPrice,
      pricingModel: roomForm.pricingModel,
      pricePerGuest: roomForm.pricePerGuest,
      allowChildren: roomForm.allowChildren,
      minChildAge: roomForm.allowChildren ? roomForm.minChildAge ?? 0 : null,
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
    adminUndo?.pushSettingsUndo(settingsRef.current, ["customPrices"]);
    const next = applyPriceFormToSettings(settingsRef.current, priceForm);
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
  }, [adminUndo, persistSettings, priceForm]);

  const saveRuleConstructor = useCallback(async () => {
    adminUndo?.pushSettingsUndo(settingsRef.current, [...RULE_SETTINGS_KEYS]);
    const next = applyRuleFormToSettings(settingsRef.current, ruleForm);
    if (!next) {
      if (ruleForm.action === "minNights") {
        showToast("Вкажи мін. ночей, житло, дні тижня та період");
      } else {
        showToast("Обери житло, дні тижня та період");
      }
      return;
    }
    setRuleSaving(true);
    try {
      await persistSettings(next, { keys: [...RULE_SETTINGS_KEYS], background: true });
      setRuleDrawerOpen(false);
      showToast("Правила збережено");
    } finally {
      setRuleSaving(false);
    }
  }, [adminUndo, persistSettings, ruleForm]);

  const patchCustomPrice = useCallback(
    async (roomId: number | string, dateStr: string, amount: number) => {
      const rid = String(roomId);
      const prevAmount = settingsRef.current.customPrices?.[rid]?.[dateStr];
      if (prevAmount !== amount) {
        adminUndo?.pushSettingsUndo(settingsRef.current, ["customPrices"]);
      }
      const next = patchSingleCustomPrice(settingsRef.current, roomId, dateStr, amount);
      await persistSettings(next, { keys: ["customPrices"], background: true });
    },
    [adminUndo, persistSettings]
  );

  const saveGenericModal = useCallback(async () => {
    let next = { ...settings };

    if (editType === "room") {
      const name = roomForm.name || "Новий котедж";
      const short = roomForm.short.trim() || name;
      const rooms = [...(settings.roomsList || [])];
      const roomPatch: Omit<RoomConfig, "id"> = {
        name,
        short,
        desc: roomForm.desc,
        capacity: roomForm.capacity,
        maxCapacity: roomForm.maxCapacity,
        extraGuestPrice: roomForm.extraGuestPrice,
        pricingModel: roomForm.pricingModel,
        pricePerGuest: roomForm.pricePerGuest,
        allowChildren: roomForm.allowChildren,
        minChildAge: roomForm.allowChildren ? roomForm.minChildAge ?? 0 : null,
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
    transactionForm,
    persistSettings,
    adminUndo,
  ]);

  const upsertRoomInSettings = useCallback(
    (photos: string[]) => {
      if (roomDrawerId == null) return { ...settings };
      const name = roomForm.name || "Новий котедж";
      const short = roomForm.short.trim() || name;
      const rooms = [...(settings.roomsList || [])];
      const roomPatch: Omit<RoomConfig, "id" | "priceWeekday" | "priceWeekend"> = {
        name,
        short,
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

  return {
    genericOpen,
    priceDrawerOpen,
    priceSaving,
    ruleDrawerOpen,
    ruleSaving,
    editType,
    editId,
    modalTitle: genericModalTitle(editType, editId),
    showDeleteBtn: editId != null && editType !== "price" && editType !== "restriction",
    openGenericModal,
    openPriceConstructor,
    closePriceConstructor,
    savePriceConstructor,
    openRuleConstructor,
    closeRuleConstructor,
    saveRuleConstructor,
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
    clearRulesAlert,
    roomForm,
    setRoomForm,
    roomPhotosBusy,
    handleRoomPhotosSelected,
    priceForm,
    setPriceForm,
    ruleForm,
    setRuleForm,
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
