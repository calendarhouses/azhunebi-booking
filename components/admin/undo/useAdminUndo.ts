"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  deleteAdminBooking,
  getAdminTenantId,
  postAdminBooking,
  saveAdminSettings,
} from "@/components/admin/desktop/adminApi";
import { handleSaveApiErrors, isBookingSaveSuccessful } from "@/components/admin/desktop/bookingForm";
import { findRoomForBooking } from "@/components/admin/desktop/bookingUtils";
import { showToast, syncLegacyGlobals } from "@/components/admin/desktop/adminGlobals";
import { AdminUnauthorizedError } from "@/lib/admin/adminSession";
import {
  applyBookingMove,
  bookingMoveKey,
  buildBookingMovePayload,
  HOLDING_ROOM,
} from "@/components/admin/desktop/timelineBookingMove";
import type { AdminSettingsPayload, BookingRecord, RoomConfig } from "@/components/admin/desktop/types";

const MAX_UNDO_STACK = 20;
const PENDING_RESTORE_PREFIX = "__undo-pending-";

export type SettingsUndoKey = "customPrices" | "restrictions" | "closedDates" | "roomsList";

export type UndoScope = "booking" | "prices" | "restrictions";

const UNDO_SCOPES: UndoScope[] = ["booking", "prices", "restrictions"];

export function resolveActiveUndoScope(
  activeView: string,
  settingsTab?: string
): UndoScope | null {
  if (activeView === "grid") return "booking";
  if (activeView === "settings" && settingsTab === "prices") return "prices";
  if (activeView === "settings" && settingsTab === "restrictions") return "restrictions";
  return null;
}

type UndoStacks = Record<UndoScope, UndoEntry[]>;

function createEmptyUndoStacks(): UndoStacks {
  return { booking: [], prices: [], restrictions: [] };
}

function deriveSettingsUndoScope(keys: SettingsUndoKey[]): UndoScope {
  if (keys.some((key) => key === "restrictions" || key === "closedDates")) {
    return "restrictions";
  }
  return "prices";
}

type UndoEntry =
  | {
      id: string;
      type: "booking_move";
      key: string | number;
      seq: number;
      previousBooking: BookingRecord;
      previousRoom: RoomConfig;
    }
  | {
      id: string;
      type: "booking_delete";
      booking: BookingRecord;
    }
  | {
      id: string;
      type: "booking_save";
      key: string | number;
      seq: number;
      previousBooking: BookingRecord | null;
      savedBooking: BookingRecord;
    }
  | {
      id: string;
      type: "settings";
      keys: SettingsUndoKey[];
      previousSlice: Partial<AdminSettingsPayload>;
      seq: number;
    };

export type UseAdminUndoDeps = {
  bookings: BookingRecord[];
  roomsList?: RoomConfig[];
  setBookings: React.Dispatch<React.SetStateAction<BookingRecord[]>>;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettingsPayload>>;
  onAfterBookingChange?: () => void | Promise<void>;
  onSessionExpired?: () => void | Promise<void>;
  /** Поточний екран — для Ctrl+Z лише в активному контексті. */
  activeUndoScope?: UndoScope | null;
};

function removeUndoById(stacks: UndoStacks, id: string) {
  for (const scope of UNDO_SCOPES) {
    const idx = stacks[scope].findIndex((e) => e.id === id);
    if (idx >= 0) {
      stacks[scope].splice(idx, 1);
      return;
    }
  }
}

function removeUndoByKeySeq(stacks: UndoStacks, key: string | number, seq: number) {
  for (const scope of UNDO_SCOPES) {
    const stack = stacks[scope];
    for (let i = stack.length - 1; i >= 0; i--) {
      const entry = stack[i];
      if (
        (entry.type === "booking_move" || entry.type === "booking_save") &&
        entry.key === key &&
        entry.seq === seq
      ) {
        stack.splice(i, 1);
        return;
      }
    }
  }
}

function cloneSettingsSlice(
  settings: AdminSettingsPayload,
  keys: SettingsUndoKey[]
): Partial<AdminSettingsPayload> {
  const slice: Partial<AdminSettingsPayload> = {};
  for (const key of keys) {
    if (key === "customPrices") {
      slice.customPrices = JSON.parse(JSON.stringify(settings.customPrices || {}));
    } else if (key === "restrictions") {
      slice.restrictions = JSON.parse(JSON.stringify(settings.restrictions || {}));
    } else if (key === "closedDates") {
      slice.closedDates = JSON.parse(JSON.stringify(settings.closedDates || {}));
    } else if (key === "roomsList") {
      slice.roomsList = JSON.parse(JSON.stringify(settings.roomsList || []));
    }
  }
  return slice;
}

function resolveRoomForBooking(booking: BookingRecord, roomsList: RoomConfig[]): RoomConfig | null {
  const room = findRoomForBooking(booking, roomsList);
  if (room) return room;
  if (booking.roomId == null && !booking.cottage) return null;
  return {
    id: Number(booking.roomId) || 0,
    name: String(booking.cottage || "").trim() || "Без котеджу",
    short: "",
    desc: "",
    capacity: 0,
    priceWeekday: 0,
    priceWeekend: 0,
    active: true,
  };
}

function bookingRecordToPayload(booking: BookingRecord): Record<string, unknown> {
  return {
    ...booking,
    tenant_id: getAdminTenantId(),
    row: booking.row,
    id: booking.id,
  };
}

function buildBookingRecreatePayload(
  booking: BookingRecord,
  room: RoomConfig
): Record<string, unknown> {
  const payload = bookingRecordToPayload(booking);
  delete payload.row;
  delete payload.id;
  payload.cottage = room.name;
  payload.roomId = room.id;
  return payload;
}

function pendingRestoreId(entryId: string): string {
  return `${PENDING_RESTORE_PREFIX}${entryId}`;
}

function isPendingRestoreBooking(booking: BookingRecord): boolean {
  return String(booking.id || "").startsWith(PENDING_RESTORE_PREFIX);
}

function buildPendingRestoreBooking(booking: BookingRecord, entryId: string): BookingRecord {
  return {
    ...booking,
    id: pendingRestoreId(entryId),
  };
}

export function useAdminUndo({
  bookings,
  roomsList = [],
  setBookings,
  setSettings,
  onAfterBookingChange,
  onSessionExpired,
  activeUndoScope = null,
}: UseAdminUndoDeps) {
  const undoStacksRef = useRef<UndoStacks>(createEmptyUndoStacks());
  const undoIdRef = useRef(0);
  const bookingSeqRef = useRef(new Map<string | number, number>());
  const bookingChainRef = useRef(new Map<string | number, Promise<void>>());
  const settingsSeqRef = useRef(0);
  const settingsChainRef = useRef(Promise.resolve());
  const undoChainRef = useRef(Promise.resolve());
  const undoInFlightRef = useRef(false);
  const depsRef = useRef({ bookings, roomsList });
  depsRef.current = { bookings, roomsList };

  const [undoAvailable, setUndoAvailable] = useState<Record<UndoScope, boolean>>({
    booking: false,
    prices: false,
    restrictions: false,
  });
  const [isUndoing, setIsUndoing] = useState(false);

  const syncUndoState = useCallback(() => {
    const stacks = undoStacksRef.current;
    setUndoAvailable({
      booking: stacks.booking.length > 0,
      prices: stacks.prices.length > 0,
      restrictions: stacks.restrictions.length > 0,
    });
  }, []);

  const setUndoBusy = useCallback((busy: boolean) => {
    undoInFlightRef.current = busy;
    setIsUndoing(busy);
  }, []);

  const pushEntry = useCallback(
    (scope: UndoScope, entry: UndoEntry) => {
      const stack = undoStacksRef.current[scope];
      stack.push(entry);
      if (stack.length > MAX_UNDO_STACK) {
        stack.shift();
      }
      syncUndoState();
      return entry.id;
    },
    [syncUndoState]
  );

  const nextUndoId = () => `undo-${++undoIdRef.current}`;

  const cancelUndoEntry = useCallback(
    (id: string | undefined) => {
      if (!id) return;
      removeUndoById(undoStacksRef.current, id);
      syncUndoState();
    },
    [syncUndoState]
  );

  const removePendingRestore = useCallback(
    (entryId: string) => {
      const pid = pendingRestoreId(entryId);
      setBookings((prev) => {
        const next = prev.filter((b) => String(b.id) !== pid);
        window.allBookings = next;
        return next;
      });
    },
    [setBookings]
  );

  const enqueueBookingSave = useCallback(
    (
      key: string | number,
      seq: number,
      booking: BookingRecord,
      room: RoomConfig,
      checkIn: string,
      checkOut: string,
      onFailure?: () => void,
      syncOnSuccess = false
    ) => {
      const saveTask = async () => {
        try {
          const payload = buildBookingMovePayload(booking, room, checkIn, checkOut);
          const json = await postAdminBooking(payload);
          if (bookingSeqRef.current.get(key) !== seq) return;

          handleSaveApiErrors(json);
          if (!isBookingSaveSuccessful(json)) {
            showToast("Зміни броні не збережено");
            onFailure?.();
            await onAfterBookingChange?.();
            return;
          }
          if (syncOnSuccess) {
            await onAfterBookingChange?.();
          }
        } catch (err) {
          if (bookingSeqRef.current.get(key) !== seq) return;

          if (err instanceof AdminUnauthorizedError) {
            await onSessionExpired?.();
            return;
          }
          showToast("Помилка збереження броні");
          onFailure?.();
          await onAfterBookingChange?.();
        }
      };

      const prev = bookingChainRef.current.get(key) ?? Promise.resolve();
      const next = prev.then(saveTask).catch(() => undefined);
      bookingChainRef.current.set(key, next);
      return next;
    },
    [onAfterBookingChange, onSessionExpired]
  );

  const enqueueBookingPayloadSave = useCallback(
    (
      key: string | number,
      seq: number,
      payload: Record<string, unknown>,
      onFailure?: () => void,
      syncOnSuccess = false
    ) => {
      const saveTask = async () => {
        try {
          const json = await postAdminBooking(payload);
          if (bookingSeqRef.current.get(key) !== seq) return;

          handleSaveApiErrors(json);
          if (!isBookingSaveSuccessful(json)) {
            showToast("Зміни броні не збережено");
            onFailure?.();
            await onAfterBookingChange?.();
            return;
          }
          if (syncOnSuccess) {
            await onAfterBookingChange?.();
          }
        } catch (err) {
          if (bookingSeqRef.current.get(key) !== seq) return;

          if (err instanceof AdminUnauthorizedError) {
            await onSessionExpired?.();
            return;
          }
          showToast("Помилка збереження броні");
          onFailure?.();
          await onAfterBookingChange?.();
        }
      };

      const prev = bookingChainRef.current.get(key) ?? Promise.resolve();
      const next = prev.then(saveTask).catch(() => undefined);
      bookingChainRef.current.set(key, next);
      return next;
    },
    [onAfterBookingChange, onSessionExpired]
  );

  const enqueueSettingsSave = useCallback(
    (seq: number, payload: AdminSettingsPayload, keys: SettingsUndoKey[], onFailure?: () => void) => {
      const saveTask = async () => {
        try {
          await saveAdminSettings(payload, { keys });
          if (settingsSeqRef.current !== seq) return;
        } catch (err) {
          if (settingsSeqRef.current !== seq) return;

          if (err instanceof AdminUnauthorizedError) {
            await onSessionExpired?.();
            return;
          }
          showToast("Не вдалося зберегти налаштування");
          onFailure?.();
        }
      };

      settingsChainRef.current = settingsChainRef.current.then(saveTask).catch(() => undefined);
      return settingsChainRef.current;
    },
    [onSessionExpired]
  );

  const pushSettingsUndo = useCallback(
    (settings: AdminSettingsPayload, keys: SettingsUndoKey[]) => {
      const scope = deriveSettingsUndoScope(keys);
      return pushEntry(scope, {
        id: nextUndoId(),
        type: "settings",
        keys,
        previousSlice: cloneSettingsSlice(settings, keys),
        seq: 0,
      });
    },
    [pushEntry]
  );

  const handleMoveBooking = useCallback(
    (
      booking: BookingRecord,
      room: RoomConfig,
      checkIn: string,
      checkOut: string,
      overrides?: Partial<BookingRecord>
    ) => {
      const previousRoom =
        booking.assignmentState === "holding"
          ? HOLDING_ROOM
          : resolveRoomForBooking(booking, depsRef.current.roomsList);
      if (!previousRoom) return;

      const key = bookingMoveKey(booking);
      const seq = (bookingSeqRef.current.get(key) ?? 0) + 1;
      bookingSeqRef.current.set(key, seq);

      pushEntry("booking", {
        id: nextUndoId(),
        type: "booking_move",
        key,
        seq,
        previousBooking: { ...booking },
        previousRoom,
      });

      const updated = {
        ...applyBookingMove(booking, room, checkIn, checkOut),
        ...overrides,
      };
      flushSync(() => {
        setBookings((prev) => {
          const next = prev.map((b) => (bookingMoveKey(b) === key ? updated : b));
          window.allBookings = next;
          return next;
        });
      });

      enqueueBookingSave(key, seq, updated, room, checkIn, checkOut, () => {
        removeUndoByKeySeq(undoStacksRef.current, key, seq);
        syncUndoState();
      });
    },
    [enqueueBookingSave, pushEntry, setBookings, syncUndoState]
  );

  const recordBookingDelete = useCallback(
    (booking: BookingRecord) => {
      return pushEntry("booking", {
        id: nextUndoId(),
        type: "booking_delete",
        booking: { ...booking },
      });
    },
    [pushEntry]
  );

  const recordBookingSave = useCallback(
    (previousBooking: BookingRecord | null, savedBooking: BookingRecord) => {
      const key = bookingMoveKey(savedBooking);
      const seq = (bookingSeqRef.current.get(key) ?? 0) + 1;
      bookingSeqRef.current.set(key, seq);
      return pushEntry("booking", {
        id: nextUndoId(),
        type: "booking_save",
        key,
        seq,
        previousBooking: previousBooking ? { ...previousBooking } : null,
        savedBooking: { ...savedBooking },
      });
    },
    [pushEntry]
  );

  const executeUndoEntry = useCallback(
    async (entry: UndoEntry, scope: UndoScope) => {
      const { bookings: currentBookings, roomsList: currentRooms } = depsRef.current;

      if (entry.type === "booking_move") {
        const { key, previousBooking, previousRoom } = entry;
        const seq = (bookingSeqRef.current.get(key) ?? 0) + 1;
        bookingSeqRef.current.set(key, seq);

        flushSync(() => {
          setBookings((prev) => {
            const next = prev.map((b) => (bookingMoveKey(b) === key ? previousBooking : b));
            window.allBookings = next;
            return next;
          });
        });

        await enqueueBookingSave(
          key,
          seq,
          previousBooking,
          previousRoom,
          previousBooking.checkIn,
          previousBooking.checkOut,
          undefined,
          true
        );
        return;
      }

      if (entry.type === "booking_delete") {
        const booking = entry.booking;
        const room = resolveRoomForBooking(booking, currentRooms);
        if (!room) {
          undoStacksRef.current[scope].push(entry);
          syncUndoState();
          showToast("Не вдалося відновити бронь");
          return;
        }

        const pending = buildPendingRestoreBooking(booking, entry.id);
        flushSync(() => {
          setBookings((prev) => {
            const exists = prev.some(
              (b) =>
                bookingMoveKey(b) === bookingMoveKey(booking) ||
                String(b.id) === String(pending.id)
            );
            if (exists) return prev;
            const next = [...prev, pending];
            window.allBookings = next;
            return next;
          });
        });

        try {
          const json = await postAdminBooking(buildBookingRecreatePayload(booking, room));
          handleSaveApiErrors(json);
          if (!isBookingSaveSuccessful(json)) {
            removePendingRestore(entry.id);
            undoStacksRef.current[scope].push(entry);
            syncUndoState();
            showToast("Не вдалося відновити бронь");
            return;
          }
          await onAfterBookingChange?.();
          showToast("Бронь відновлено");
        } catch (err) {
          removePendingRestore(entry.id);
          undoStacksRef.current[scope].push(entry);
          syncUndoState();
          if (err instanceof AdminUnauthorizedError) {
            await onSessionExpired?.();
            return;
          }
          showToast("Помилка відновлення броні");
        }
        return;
      }

      if (entry.type === "booking_save") {
        const { key, previousBooking, savedBooking } = entry;
        const seq = (bookingSeqRef.current.get(key) ?? 0) + 1;
        bookingSeqRef.current.set(key, seq);

        if (previousBooking === null) {
          flushSync(() => {
            setBookings((prev) => {
              const next = prev.filter((b) => bookingMoveKey(b) !== key);
              window.allBookings = next;
              return next;
            });
          });

          try {
            await deleteAdminBooking({
              row: savedBooking.row,
              id:
                savedBooking.id != null && String(savedBooking.id).trim()
                  ? String(savedBooking.id)
                  : undefined,
            });
            await onAfterBookingChange?.();
          } catch (err) {
            undoStacksRef.current[scope].push(entry);
            syncUndoState();
            if (err instanceof AdminUnauthorizedError) {
              await onSessionExpired?.();
              return;
            }
            showToast("Не вдалося скасувати створення броні");
            await onAfterBookingChange?.();
          }
          return;
        }

        flushSync(() => {
          setBookings((prev) => {
            const next = prev.map((b) => (bookingMoveKey(b) === key ? previousBooking : b));
            window.allBookings = next;
            return next;
          });
        });

        const room = resolveRoomForBooking(previousBooking, currentRooms);
        if (room) {
          await enqueueBookingSave(
            key,
            seq,
            previousBooking,
            room,
            previousBooking.checkIn,
            previousBooking.checkOut,
            undefined,
            true
          );
        } else {
          await enqueueBookingPayloadSave(
            key,
            seq,
            bookingRecordToPayload(previousBooking),
            undefined,
            true
          );
        }
        return;
      }

      if (entry.type === "settings") {
        const seq = ++settingsSeqRef.current;
        let restoredPayload: AdminSettingsPayload | null = null;

        flushSync(() => {
          setSettings((prev) => {
            const next = { ...prev, ...entry.previousSlice };
            restoredPayload = next;
            syncLegacyGlobals({ bookings: currentBookings, settings: next });
            return next;
          });
        });

        if (restoredPayload) {
          await enqueueSettingsSave(seq, restoredPayload, entry.keys, () => {
            removeUndoById(undoStacksRef.current, entry.id);
            syncUndoState();
          });
        }
      }
    },
    [
      enqueueBookingPayloadSave,
      enqueueBookingSave,
      enqueueSettingsSave,
      onAfterBookingChange,
      onSessionExpired,
      removePendingRestore,
      setBookings,
      setSettings,
      syncUndoState,
    ]
  );

  const undoLastInScope = useCallback(
    (scope: UndoScope) => {
      const stack = undoStacksRef.current[scope];
      if (undoInFlightRef.current || stack.length === 0) return;

      undoChainRef.current = undoChainRef.current
        .then(async () => {
          const entry = stack.pop();
          if (!entry) return;

          syncUndoState();
          setUndoBusy(true);
          try {
            await executeUndoEntry(entry, scope);
          } finally {
            setUndoBusy(false);
          }
        })
        .catch(() => undefined);
    },
    [executeUndoEntry, setUndoBusy, syncUndoState]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!activeUndoScope || !undoAvailable[activeUndoScope] || isUndoing) return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z" || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      undoLastInScope(activeUndoScope);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeUndoScope, undoAvailable, isUndoing, undoLastInScope]);

  return {
    undoAvailable,
    isUndoing,
    undoLastInScope,
    cancelUndoEntry,
    handleMoveBooking,
    recordBookingDelete,
    recordBookingSave,
    pushSettingsUndo,
    isPendingRestoreBooking,
  };
}

export type AdminUndoApi = ReturnType<typeof useAdminUndo>;
