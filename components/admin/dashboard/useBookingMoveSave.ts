"use client";

import { useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { postAdminBooking } from "@/components/admin/desktop/adminApi";
import { handleSaveApiErrors, isBookingSaveSuccessful } from "@/components/admin/desktop/bookingForm";
import { showToast } from "@/components/admin/desktop/adminGlobals";
import { AdminUnauthorizedError } from "@/lib/admin/adminSession";
import {
  applyBookingMove,
  bookingMoveKey,
  buildBookingMovePayload,
} from "@/components/admin/desktop/timelineBookingMove";
import type { BookingRecord, RoomConfig } from "@/components/admin/desktop/types";

type MoveSaveDeps = {
  onBookingUpdated?: (booking: BookingRecord) => void;
  onAfterBookingChange?: () => void | Promise<void>;
  onSessionExpired?: () => void | Promise<void>;
};

/** Optimistic move + serial save per booking (latest move wins, no success toasts). */
export function useBookingMoveSave({
  onBookingUpdated,
  onAfterBookingChange,
  onSessionExpired,
}: MoveSaveDeps) {
  const seqByKeyRef = useRef(new Map<string | number, number>());
  const chainByKeyRef = useRef(new Map<string | number, Promise<void>>());

  const handleMoveBooking = useCallback(
    (booking: BookingRecord, room: RoomConfig, checkIn: string, checkOut: string) => {
      const key = bookingMoveKey(booking);
      const seq = (seqByKeyRef.current.get(key) ?? 0) + 1;
      seqByKeyRef.current.set(key, seq);

      const updated = applyBookingMove(booking, room, checkIn, checkOut);
      flushSync(() => {
        onBookingUpdated?.(updated);
      });

      const saveTask = async () => {
        try {
          const payload = buildBookingMovePayload(updated, room, checkIn, checkOut);
          const json = await postAdminBooking(payload);
          if (seqByKeyRef.current.get(key) !== seq) return;

          handleSaveApiErrors(json);
          if (!isBookingSaveSuccessful(json)) {
            showToast("Бронь не переміщено");
            await onAfterBookingChange?.();
          }
        } catch (err) {
          if (seqByKeyRef.current.get(key) !== seq) return;

          if (err instanceof AdminUnauthorizedError) {
            await onSessionExpired?.();
            return;
          }
          showToast("Помилка переміщення");
          await onAfterBookingChange?.();
        }
      };

      const prev = chainByKeyRef.current.get(key) ?? Promise.resolve();
      const next = prev.then(saveTask).catch(() => undefined);
      chainByKeyRef.current.set(key, next);
    },
    [onAfterBookingChange, onBookingUpdated, onSessionExpired]
  );

  return handleMoveBooking;
}
