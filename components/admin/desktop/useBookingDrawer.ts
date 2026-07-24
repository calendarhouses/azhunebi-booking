"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatPhone, normalizeDateToIso } from "./adminDates";
import { showToast } from "./adminGlobals";
import { bosoLeave } from "./adminTooltip";
import { selectOption, setBookingSourceDefault, setBookingSourceFromSaved } from "./adminUiHelpers";
import {
  clampOccupantsForRoom,
  getRoomMaxCapacity,
  defaultBookingDrawerForm,
  pickPriceFormInput,
  type BookingDrawerFormState,
  type SchedulePriceLabels,
  type YesNo,
} from "./bookingDrawerForm";
import {
  applyEarlyLateChips,
  renderCottageOptions,
  resetFlexibleSchedule,
  setBookingStatus,
  setModeToggle,
  togglePet,
  toggleVat,
} from "./bookingDrawerDom";
import { findRoomForBooking, formatRoomDisplayLabel, parseBookingComment } from "./bookingUtils";
import { roomSidebarDisplayName } from "./TimelineSidebarRooms";
import { adminRoomCottageValue } from "@/lib/admin/roomDisplay";
import { HOLDING_ROOM_ID } from "./timelineBookingMove";
import {
  childrenPolicyViolationMessage,
  DEFAULT_YOUNGEST_CHILD_AGE,
  listServicesForRoom,
  MAX_CHILD_AGE,
  migrateLegacyServiceSelection,
  roomAllowsChildren,
} from "./settings/additionalServicesLogic";
import {
  getBookingPayments,
  resolveBookingExpectedPrepay,
  syncJournalTotals,
} from "@/lib/admin/bookingPayments";
import { buildStayNightlyBasePrices, readPrepaymentPolicy } from "@/lib/public-booking/prepaymentPolicy";
import type { PublicBranding } from "@/lib/public-booking/types";
import {
  defaultSpecialTariffState,
  enabledSpecialTariffIds,
  listActiveSpecialTariffDiscounts,
  type SpecialTariffToggle,
} from "@/lib/admin/specialTariffBooking";
import type { AdminSettingsPayload, BookingRecord, RoomConfig } from "./types";
import { normalizeBookingCustomColor } from "@/lib/bookingCustomColor";
function isoDatePlusDays(iso: string, days: number): string {
  const base = normalizeDateToIso(iso);
  if (!base) return "";
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function syncFormFieldsToDom(form: BookingDrawerFormState): void {
  if (typeof document === "undefined") return;
  const set = (id: string, value: string) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) el.value = value;
  };
  set("adminName", form.name);
  set("adminPhone", form.phone);
  set("adminSource", form.source);
  set("adminComment", form.comment);
  set("adminCottage", form.cottage);
  set("adminRoomId", form.roomId != null ? String(form.roomId) : "");
  set("adminGuests", String(form.guests));
  set("adminChildren", String(form.children));
  set("adminYoungestChildAge", String(form.youngestChildAge));
  set("adminPets", form.pets);
  set("adminDayGuests", String(form.dayGuests));
  set("adminVat", form.vat);
  set("adminCustomColor", form.customColor);
  set("adminCheckIn", form.checkIn);
  set("adminCheckOut", form.checkOut);
  const cottageLabel = document.getElementById("cottageSelectedText");
  if (cottageLabel) cottageLabel.textContent = form.cottageLabel;
  const sourceLabel = document.getElementById("sourceSelectedText");
  if (sourceLabel) sourceLabel.textContent = form.source;
  setModeToggle(".pet-btn", form.pets);
  setModeToggle(".chan-btn", form.vat);
  setBookingStatus(form.status);
  document.getElementById("adminCardEarly")?.classList.toggle("active", form.earlyCardActive);
  document.getElementById("adminCardLate")?.classList.toggle("active", form.lateCardActive);
}

export type UseBookingDrawerParams = {
  bookings: BookingRecord[];
  settings: AdminSettingsPayload;
  editingRowRef: React.MutableRefObject<number | string | null>;
  earlyTimeRef: React.MutableRefObject<string | null>;
  lateTimeRef: React.MutableRefObject<string | null>;
  setBookings?: React.Dispatch<React.SetStateAction<BookingRecord[]>>;
};

export function useBookingDrawer({
  bookings,
  settings,
  editingRowRef,
  earlyTimeRef,
  lateTimeRef,
  setBookings,
}: UseBookingDrawerParams) {
  const findBookingByKey = useCallback(
    (key: number | string) => {
      const normalized = String(key);
      return (
        bookings.find((b) => String(b.id) === normalized) ??
        bookings.find((b) => String(b.row) === normalized)
      );
    },
    [bookings]
  );

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isInitialPriceLoad, setIsInitialPriceLoad] = useState(false);
  const [earlyTime, setEarlyTimeState] = useState<string | null>(null);
  const [lateTime, setLateTimeState] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<number | string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [form, setForm] = useState<BookingDrawerFormState>(defaultBookingDrawerForm);
  const [drawerTitle, setDrawerTitle] = useState("Деталі бронювання");
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [scheduleLabels, setScheduleLabels] = useState<SchedulePriceLabels>({
    early: "Оберіть дати",
    late: "Оберіть дати",
  });
  const [initialPayment, setInitialPayment] = useState({
    prepay: 0,
    surcharge: 0,
    prepayMethod: "ФОП",
    surchargeMethod: "Готівка",
  });

  const roomsList = settings.roomsList || [];

  const specialTariffToggles = useMemo(
    () => listActiveSpecialTariffDiscounts(settings.discountsList || []),
    [settings.discountsList]
  );

  useEffect(() => {
    setForm((prev) => {
      let changed = false;
      const next = { ...prev.specialTariffs };
      for (const toggle of specialTariffToggles) {
        if (next[toggle.id] === undefined) {
          next[toggle.id] = "Ні";
          changed = true;
        }
      }
      return changed ? { ...prev, specialTariffs: next } : prev;
    });
  }, [specialTariffToggles]);

  const priceForm = useMemo(
    () => pickPriceFormInput(form),
    [
      form.checkIn,
      form.checkOut,
      form.cottage,
      form.roomId,
      form.guests,
      form.children,
      form.pets,
      form.dayGuests,
      form.vat,
      form.selectedServices,
      form.specialTariffs,
      form.promoCode,
    ]
  );

  const availableServices = useMemo(() => {
    const room =
      (form.roomId != null
        ? roomsList.find((r) => String(r.id) === String(form.roomId))
        : undefined) || roomsList.find((r) => r.name === form.cottage);
    return listServicesForRoom(settings.customServicesList, room);
  }, [form.cottage, form.roomId, roomsList, settings.customServicesList]);

  const maxOccupants = useMemo(
    () => getRoomMaxCapacity(form.cottage, roomsList, form.roomId),
    [form.cottage, form.roomId, roomsList]
  );

  const showChildren = true;

  const selectedRoomForPolicy = useMemo(() => {
    return (
      (form.roomId != null
        ? roomsList.find((r) => String(r.id) === String(form.roomId))
        : undefined) || roomsList.find((r) => r.name === form.cottage)
    );
  }, [form.cottage, form.roomId, roomsList]);

  const childrenPolicyMessage = useMemo(
    () =>
      childrenPolicyViolationMessage(
        selectedRoomForPolicy,
        form.children,
        form.youngestChildAge
      ),
    [selectedRoomForPolicy, form.children, form.youngestChildAge]
  );
  const childrenPolicyBlocked = Boolean(childrenPolicyMessage);

  const patchForm = useCallback((partial: Partial<BookingDrawerFormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  const setFormField = useCallback(
    <K extends keyof BookingDrawerFormState>(key: K, value: BookingDrawerFormState[K]) => {
      patchForm({ [key]: value } as Partial<BookingDrawerFormState>);
    },
    [patchForm]
  );

  const bumpPrice = useCallback((initial = false) => {
    setIsInitialPriceLoad(initial);
  }, []);

  const openedCustomColorRef = useRef("");
  const drawerSessionSavedRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;

  const revertColorPreview = useCallback(() => {
    const editingKey = editingRowRef.current;
    if (drawerSessionSavedRef.current || editingKey == null || !setBookings) return;
    const originalColor = openedCustomColorRef.current;
    setBookings((prev) =>
      prev.map((b) => {
        if (String(b.id) !== String(editingKey) && String(b.row) !== String(editingKey)) {
          return b;
        }
        if ((b.custom_color ?? "") === originalColor) return b;
        return { ...b, custom_color: originalColor };
      })
    );
  }, [editingRowRef, setBookings]);

  const closeDrawer = useCallback(() => {
    revertColorPreview();
    drawerSessionSavedRef.current = false;
    if (typeof window !== "undefined") {
      (window as Window & { _bookingBookmenowCommentTokens?: string[] })._bookingBookmenowCommentTokens =
        [];
    }
    if (typeof document !== "undefined") {
      document.getElementById("bookingDrawer")?.classList.remove("active");
    }
    setDrawerOpen(false);
  }, [revertColorPreview]);

  const markDrawerSessionSaved = useCallback(() => {
    drawerSessionSavedRef.current = true;
    openedCustomColorRef.current = normalizeBookingCustomColor(formRef.current.customColor) || "";
  }, []);

  const openDrawerShell = useCallback(() => {
    if (typeof document !== "undefined") {
      const body = document.querySelector(".drawer-body");
      if (body) (body as HTMLElement).scrollTop = 0;
      document.getElementById("bookingDrawer")?.classList.remove("active");
    }
    setDrawerOpen(true);
    if (typeof document !== "undefined") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById("bookingDrawer")?.classList.add("active");
        });
      });
    }
  }, []);

  const resolveRoomPrefill = useCallback(
    (prefill: string | null | undefined): RoomConfig | null => {
      if (!prefill) return null;
      if (prefill === "Нерозподілені" || prefill === String(HOLDING_ROOM_ID)) return null;
      return (
        roomsList.find((r) => String(r.id) === prefill) ||
        roomsList.find((r) => r.name === prefill) ||
        roomsList.find((r) => r.short === prefill) ||
        null
      );
    },
    [roomsList]
  );

  const syncCottageUi = useCallback(
    (roomKey: string) => {
      const holding = roomKey === "Нерозподілені" || roomKey === String(HOLDING_ROOM_ID);
      window._bookingAssignmentState = holding ? "holding" : "assigned";
      const room = holding ? null : resolveRoomPrefill(roomKey);
      const cottageName = holding
        ? "Нерозподілені"
        : room
          ? adminRoomCottageValue(room)
          : roomKey;
      const label = holding
        ? "Нерозподілені"
        : room
          ? roomSidebarDisplayName(room)
          : cottageName;
      setForm((prev) => {
        const { adults, children: rawChildren } = clampOccupantsForRoom(
          prev.guests,
          prev.children,
          cottageName,
          roomsList,
          room?.id
        );
        return {
          ...prev,
          cottage: cottageName,
          cottageLabel: label ? formatRoomDisplayLabel(label, room?.desc) : "Оберіть котедж",
          roomId: holding ? null : room?.id ?? null,
          guests: adults,
          children: rawChildren,
        };
      });
    },
    [resolveRoomPrefill, roomsList]
  );

  const populateCottageOptions = useCallback(
    (includeInactiveName?: string) => {
      const active = roomsList.filter((r) => r.active);
      const list: RoomConfig[] =
        includeInactiveName && !active.some((r) => r.name === includeInactiveName)
          ? [...active, ...roomsList.filter((r) => r.name === includeInactiveName)]
          : active.length
            ? active
            : roomsList;
      renderCottageOptions(
        [
          ...list.map((r) => ({
            id: String(r.id),
            name: r.name,
            label: roomSidebarDisplayName(r),
            desc: r.desc,
          })),
          {
            id: String(HOLDING_ROOM_ID),
            name: "Нерозподілені",
            label: "Нерозподілені",
            desc: "Без будинку",
          },
        ],
        (roomKey, display) => {
          const room = resolveRoomPrefill(roomKey);
          const cottageName =
            roomKey === String(HOLDING_ROOM_ID) || roomKey === "Нерозподілені"
              ? "Нерозподілені"
              : room?.name || roomKey;
          selectOption("cottageWrapper", "adminCottage", cottageName, null, display);
          syncCottageUi(roomKey);
        }
      );
    },
    [resolveRoomPrefill, roomsList, syncCottageUi]
  );

  const setEarlyTime = useCallback(
    (time: string | null) => {
      earlyTimeRef.current = time;
      setEarlyTimeState(time);
    },
    [earlyTimeRef]
  );

  const setLateTime = useCallback(
    (time: string | null) => {
      lateTimeRef.current = time;
      setLateTimeState(time);
    },
    [lateTimeRef]
  );

  const openNewBookingDrawer = useCallback(
    (prefillRoom: string | null = null, prefillDateStart: string | null = null, prefillDateEnd: string | null = null) => {
      drawerSessionSavedRef.current = false;
      openedCustomColorRef.current = "";
      editingRowRef.current = null;
      setEditingRow(null);
      setEditingBookingId(null);
      earlyTimeRef.current = null;
      lateTimeRef.current = null;
      setEarlyTimeState(null);
      setLateTimeState(null);

      setDrawerTitle("Нове бронювання");
      setShowDeleteBtn(false);
      setInitialPayment({ prepay: 0, surcharge: 0, prepayMethod: "ФОП", surchargeMethod: "Готівка" });
      window._bookingOpenPayments = { prepay: 0, surcharge: 0 };
      window._bookingExpectedPrepay = 0;
      window._bookingAssignmentState =
        prefillRoom === "Нерозподілені" || prefillRoom === String(HOLDING_ROOM_ID)
          ? "holding"
          : "assigned";

      const activeRooms = roomsList.filter((r) => r.active);
      const isHolding =
        prefillRoom === "Нерозподілені" || prefillRoom === String(HOLDING_ROOM_ID);
      const defaultRoomConfig = isHolding
        ? null
        : resolveRoomPrefill(prefillRoom) || activeRooms[0] || null;
      const defaultRoom = isHolding
        ? "Нерозподілені"
        : defaultRoomConfig?.name || "";
      const cottageLabel = isHolding
        ? "Нерозподілені"
        : defaultRoomConfig
          ? formatRoomDisplayLabel(
              roomSidebarDisplayName(defaultRoomConfig),
              defaultRoomConfig.desc
            )
          : "Оберіть котедж";

      const checkIn = prefillDateStart ? normalizeDateToIso(prefillDateStart) : "";
      const checkOut = prefillDateEnd
        ? normalizeDateToIso(prefillDateEnd)
        : checkIn
          ? isoDatePlusDays(checkIn, 1)
          : "";

      window._bookingPayments = [];
      window._bookingPaymentMeta = { createdAt: checkIn || undefined, checkOut: checkOut || undefined };
      (window as Window & { _bookingBookmenowCommentTokens?: string[] })._bookingBookmenowCommentTokens =
        [];

      setForm({
        ...defaultBookingDrawerForm(),
        cottage: defaultRoom,
        cottageLabel,
        roomId: isHolding ? null : defaultRoomConfig?.id ?? null,
        checkIn,
        checkOut,
        specialTariffs: defaultSpecialTariffState(specialTariffToggles),
      });

      resetFlexibleSchedule();
      setBookingSourceDefault();
      populateCottageOptions();

      openDrawerShell();
      setTimeout(() => bumpPrice(), 100);
    },
    [
      editingRowRef,
      earlyTimeRef,
      lateTimeRef,
      roomsList,
      resolveRoomPrefill,
      populateCottageOptions,
      openDrawerShell,
      bumpPrice,
      specialTariffToggles,
    ]
  );

  const openDetailsByRow = useCallback(
    (event: unknown, bookingKey: number | string) => {
      (event as { stopPropagation?: () => void } | null)?.stopPropagation?.();
      bosoLeave();

      if (String(bookingKey).startsWith("temp_")) {
        showToast("Бронь ще записується. Зачекайте 2 секунди...");
        return;
      }

      const booking = findBookingByKey(bookingKey);
      if (!booking) return;

      const editingKey = booking.id || booking.row;
      editingRowRef.current = editingKey;
      setEditingRow(editingKey);
      setEditingBookingId(booking.id || null);
      setDrawerTitle(`Деталі броні ${booking.id || ""}`);
      setShowDeleteBtn(true);

      const parsed = parseBookingComment(booking.comment || "", specialTariffToggles);
      (window as Window & { _bookingBookmenowCommentTokens?: string[] })._bookingBookmenowCommentTokens =
        parsed.bookmenowTokens;
      const matchedRoom = findRoomForBooking(booking, roomsList);
      const savedRoom =
        booking.assignmentState === "holding"
          ? "Нерозподілені"
          : matchedRoom
            ? String(matchedRoom.short || matchedRoom.name || "")
            : String(booking.cottage || "");
      const room = matchedRoom ?? roomsList.find((r) => r.name === savedRoom);
      const cottageLabel =
        booking.assignmentState === "holding"
          ? "Нерозподілені"
          : room
            ? formatRoomDisplayLabel(roomSidebarDisplayName(room), room.desc)
            : savedRoom
              ? formatRoomDisplayLabel(savedRoom)
              : "Оберіть котедж";
      const legacyServices = migrateLegacyServiceSelection(
        settings.customServicesList || [],
        { dayGuests: parsed.dayGuests, vat: parsed.vat }
      );
      const selectedServices =
        Object.keys(parsed.selectedServices).length > 0
          ? parsed.selectedServices
          : legacyServices;

      const savedPayments = getBookingPayments(booking);
      const savedPaymentTotals = syncJournalTotals(savedPayments);
      const savedPrepay = savedPaymentTotals.prepay;
      const savedSurcharge = savedPaymentTotals.surcharge;
      const rawStatus =
        booking.source === "Сайт" &&
        booking.status === "Підтверджено" &&
        savedPaymentTotals.paidAmount === 0
          ? "Очікує оплату"
          : booking.status || "Очікує оплату";
      const displayedStatus =
        rawStatus === "Нова бронь" ? "Очікує оплату" : rawStatus;

      setInitialPayment({
        prepay: savedPrepay,
        surcharge: savedSurcharge,
        prepayMethod: savedPaymentTotals.prepayMethod,
        surchargeMethod: savedPaymentTotals.surchargeMethod,
      });
      window._bookingOpenPayments = { prepay: savedPrepay, surcharge: savedSurcharge };
      {
        const policy = readPrepaymentPolicy((settings.branding || {}) as PublicBranding);
        const checkIn = normalizeDateToIso(booking.checkIn || "");
        const checkOut = normalizeDateToIso(booking.checkOut || "");
        const inDate = checkIn ? new Date(`${checkIn}T00:00:00`) : null;
        const outDate = checkOut ? new Date(`${checkOut}T00:00:00`) : null;
        const nights =
          inDate &&
          outDate &&
          !isNaN(inDate.getTime()) &&
          !isNaN(outDate.getTime())
            ? Math.max(1, Math.round((outDate.getTime() - inDate.getTime()) / 86400000))
            : 1;
        const nightlyBasePrices =
          matchedRoom && inDate && !isNaN(inDate.getTime())
            ? buildStayNightlyBasePrices({
                checkIn: inDate,
                nights,
                priceWeekday: Number(matchedRoom.priceWeekday) || 0,
                priceWeekend: Number(matchedRoom.priceWeekend) || 0,
                roomId: matchedRoom.id,
                customPrices: settings.customPrices || null,
              })
            : undefined;
        window._bookingExpectedPrepay = resolveBookingExpectedPrepay(
          booking,
          Math.round(Number(booking.totalPrice) || 0),
          {
            policy,
            basePriceTotal: Math.round(Number(booking.basePrice) || 0) || undefined,
            nights,
            nightlyBasePrices,
          }
        );
      }
      window._bookingAssignmentState =
        booking.assignmentState === "holding" ? "holding" : "assigned";
      window._bookingPayments = savedPayments;
      window._bookingPaymentMeta = {
        createdAt: String(booking.createdAt || booking.checkIn || "").substring(0, 10),
        checkOut: normalizeDateToIso(booking.checkOut || ""),
      };

      const occupants = clampOccupantsForRoom(
        Number(booking.guests) || 2,
        parsed.children,
        savedRoom,
        roomsList,
        matchedRoom?.id ?? booking.roomId
      );

      const openedColor = normalizeBookingCustomColor(booking.custom_color) || "";
      openedCustomColorRef.current = openedColor;
      drawerSessionSavedRef.current = false;

      setForm({
        ...defaultBookingDrawerForm(),
        name: String(booking.name).replace(" (Ручна бронь)", ""),
        phone: `+${formatPhone(booking.phone)}`,
        source: booking.source || "Адмінка",
        comment: parsed.guestComment,
        cottage: savedRoom,
        cottageLabel,
        roomId: matchedRoom?.id ?? booking.roomId ?? null,
        checkIn: normalizeDateToIso(booking.checkIn || ""),
        checkOut: normalizeDateToIso(booking.checkOut || ""),
        guests: occupants.adults,
        children: occupants.children,
        youngestChildAge:
          parsed.youngestChildAge ??
          (occupants.children > 0 ? DEFAULT_YOUNGEST_CHILD_AGE : DEFAULT_YOUNGEST_CHILD_AGE),
        pets: booking.pets === "Так" || booking.pets === true ? "Так" : "Ні",
        dayGuests: parsed.dayGuests,
        vat: parsed.vat,
        selectedServices,
        specialTariffs: parsed.specialTariffs,
        promoCode: parsed.promoCode,
        status: displayedStatus,
        earlyCardActive: !!parsed.earlyTime,
        lateCardActive: !!parsed.lateTime,
        customColor: openedColor,
      });

      setEarlyTime(parsed.earlyTime);
      setLateTime(parsed.lateTime);
      applyEarlyLateChips(parsed.earlyTime, parsed.lateTime);

      setBookingSourceFromSaved(booking.source || "Адмінка");
      populateCottageOptions(booking.cottage);

      openDrawerShell();
      setTimeout(() => bumpPrice(true), 100);
    },
    [
      findBookingByKey,
      editingRowRef,
      roomsList,
      populateCottageOptions,
      openDrawerShell,
      bumpPrice,
      setEarlyTime,
      setLateTime,
      specialTariffToggles,
      settings.branding,
      settings.customPrices,
      settings.customServicesList,
    ]
  );

  const changeChildren = useCallback(
    (amount: number) => {
      setForm((prev) => {
        const maxCap = getRoomMaxCapacity(prev.cottage, roomsList);
        const next = prev.children + amount;
        if (next < 0) return prev;
        if (prev.guests + next > maxCap) {
          if (amount > 0) {
            showToast(`Максимум для цієї хати: ${maxCap} гостей (дорослі + діти)`);
          }
          return prev;
        }
        return {
          ...prev,
          children: next,
          youngestChildAge:
            prev.children === 0 && next > 0
              ? DEFAULT_YOUNGEST_CHILD_AGE
              : prev.youngestChildAge,
        };
      });
    },
    [roomsList]
  );

  const changeYoungestChildAge = useCallback((amount: number) => {
    setForm((prev) => ({
      ...prev,
      youngestChildAge: Math.max(
        0,
        Math.min(MAX_CHILD_AGE, prev.youngestChildAge + amount)
      ),
    }));
  }, []);

  const setServiceQty = useCallback((serviceId: number, qty: number) => {
    setForm((prev) => ({
      ...prev,
      selectedServices: { ...prev.selectedServices, [String(serviceId)]: Math.max(0, qty) },
    }));
  }, []);

  const changeGuests = useCallback(
    (amount: number) => {
      setForm((prev) => {
        const maxCap = getRoomMaxCapacity(prev.cottage, roomsList);
        const nextAdults = prev.guests + amount;
        if (nextAdults < 1) return prev;
        if (nextAdults + prev.children > maxCap) {
          if (amount > 0) {
            showToast(`Максимум для цієї хати: ${maxCap} гостей (дорослі + діти)`);
          }
          return prev;
        }
        return { ...prev, guests: nextAdults };
      });
    },
    [roomsList]
  );

  const changeAdminDayGuests = useCallback((amount: number) => {
    setForm((prev) => {
      const next = Math.max(0, prev.dayGuests + amount);
      return { ...prev, dayGuests: next };
    });
  }, []);

  const setPets = useCallback((val: YesNo) => {
    togglePet(val);
    patchForm({ pets: val });
  }, [patchForm]);

  const setVat = useCallback((val: YesNo) => {
    toggleVat(val);
    patchForm({ vat: val });
  }, [patchForm]);

  const setSpecialTariff = useCallback((tariffId: string, val: YesNo) => {
    setForm((prev) => ({
      ...prev,
      specialTariffs: { ...prev.specialTariffs, [tariffId]: val },
    }));
  }, []);

  const setStatus = useCallback((status: string) => {
    setBookingStatus(status);
    patchForm({ status });
  }, [patchForm]);

  const setCustomColor = useCallback(
    (color: string | null) => {
      const next = normalizeBookingCustomColor(color) || "";
      patchForm({ customColor: next });

      const editingKey = editingRowRef.current;
      if (editingKey == null) return;

      // Миттєвий превʼю на шаховатці; у БД — лише по «Зберегти».
      setBookings?.((prev) =>
        prev.map((b) => {
          if (String(b.id) !== String(editingKey) && String(b.row) !== String(editingKey)) {
            return b;
          }
          return { ...b, custom_color: next };
        })
      );
    },
    [patchForm, setBookings, editingRowRef]
  );

  const selectAdminTime = useCallback(
    (type: "early" | "late", time: string, chipEl: HTMLElement) => {
      document
        .querySelectorAll(`#adminCard${type === "early" ? "Early" : "Late"} .t-chip`)
        .forEach((c) => c.classList.remove("selected"));
      chipEl.classList.add("selected");
      if (type === "early") {
        setEarlyTime(time);
        patchForm({ earlyCardActive: true });
      } else {
        setLateTime(time);
        patchForm({ lateCardActive: true });
      }
    },
    [setEarlyTime, setLateTime, patchForm]
  );

  const toggleAdminService = useCallback(
    (type: "early" | "late") => {
      if (type === "early") {
        const next = !form.earlyCardActive;
        patchForm({ earlyCardActive: next });
        if (!next) {
          setEarlyTime(null);
          document.querySelectorAll("#adminCardEarly .t-chip").forEach((c) => c.classList.remove("selected"));
        }
      } else {
        const next = !form.lateCardActive;
        patchForm({ lateCardActive: next });
        if (!next) {
          setLateTime(null);
          document.querySelectorAll("#adminCardLate .t-chip").forEach((c) => c.classList.remove("selected"));
        }
      }
    },
    [form.earlyCardActive, form.lateCardActive, patchForm, setEarlyTime, setLateTime]
  );

  const handleStatusFromPayment = useCallback(
    (status: "Очікує оплату" | "Підтверджено") => {
      if (form.status === "Скасовано" || form.status === "Закрито") return;
      if (form.status !== status) {
        setBookingStatus(status);
        patchForm({ status });
      }
    },
    [form.status, patchForm]
  );

  const finishInitialPriceLoad = useCallback(() => {
    setIsInitialPriceLoad(false);
  }, []);

  const applyScheduleLabels = useCallback((labels: SchedulePriceLabels) => {
    setScheduleLabels((prev) =>
      prev.early === labels.early && prev.late === labels.late ? prev : labels
    );
  }, []);

  const applySubmitDisabled = useCallback((disabled: boolean) => {
    setSubmitDisabled((prev) => (prev === disabled ? prev : disabled));
  }, []);

  useEffect(() => {
    if (!drawerOpen || typeof document === "undefined") return;
    syncFormFieldsToDom(form);
  }, [drawerOpen, form]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as Window & { __bookingFormDates?: { checkIn: string; checkOut: string } }).__bookingFormDates =
      {
        checkIn: form.checkIn,
        checkOut: form.checkOut,
      };
  }, [form.checkIn, form.checkOut]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (
      window as Window & { __bookingSpecialTariffToggles?: SpecialTariffToggle[] }
    ).__bookingSpecialTariffToggles = specialTariffToggles;
  }, [specialTariffToggles]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window;
    w.closeDrawer = closeDrawer;
    w.markDrawerSessionSaved = markDrawerSessionSaved;
    w.openNewBookingDrawer = openNewBookingDrawer;
    w.openDetailsByRow = openDetailsByRow;
    w.updatePricePreview = () => bumpPrice();
    w.changeGuests = changeGuests;
    w.changeAdminDayGuests = changeAdminDayGuests;
    w.togglePet = (val: string) => setPets(val as YesNo);
    w.toggleVat = (v: string) => setVat(v as YesNo);
    w.selectAdminTime = selectAdminTime;
    w.toggleAdminService = toggleAdminService;
  }, [
    closeDrawer,
    markDrawerSessionSaved,
    openNewBookingDrawer,
    openDetailsByRow,
    bumpPrice,
    changeGuests,
    changeAdminDayGuests,
    setPets,
    setVat,
    selectAdminTime,
    toggleAdminService,
  ]);

  return {
    drawerOpen,
    isInitialPriceLoad,
    setIsInitialPriceLoad: setIsInitialPriceLoad,
    earlyTime,
    lateTime,
    editingRow,
    editingBookingId,
    form,
    priceForm,
    patchForm,
    setFormField,
    drawerTitle,
    showDeleteBtn,
    submitDisabled,
    setSubmitDisabled,
    scheduleLabels,
    applyScheduleLabels,
    applySubmitDisabled,
    finishInitialPriceLoad,
    initialPayment,
    bumpPrice,
    closeDrawer,
    markDrawerSessionSaved,
    openNewBookingDrawer,
    openDetailsByRow,
    changeGuests,
    changeChildren,
    changeYoungestChildAge,
    changeAdminDayGuests,
    setPets,
    setVat,
    availableServices,
    maxOccupants,
    showChildren,
    childrenPolicyMessage,
    childrenPolicyBlocked,
    setServiceQty,
    specialTariffToggles,
    setSpecialTariff,
    setStatus,
    setCustomColor,
    selectAdminTime,
    toggleAdminService,
    handleStatusFromPayment,
    roomsList,
  };
}

declare global {
  interface Window {
    _bookingOpenPayments?: { prepay: number; surcharge: number };
    _bookingExpectedPrepay?: number;
    _bookingAssignmentState?: "assigned" | "holding";
    _bookingPayments?: import("./types").BookingPayment[];
    _bookingPaymentMeta?: { createdAt?: string; checkOut?: string };
    openNewBookingDrawer?: (
      prefillRoom?: string | null,
      prefillDateStart?: string | null,
      prefillDateEnd?: string | null
    ) => void;
    openDetailsByRow?: (event: unknown, rowNumber: number | string) => void;
    updatePricePreview?: () => void;
    changeGuests?: (amount: number) => void;
    changeAdminDayGuests?: (amount: number) => void;
    togglePet?: (val: string) => void;
    toggleVat?: (val: string) => void;
    toggleUBD?: (val: string) => void;
    selectAdminTime?: (type: "early" | "late", time: string, chipEl: HTMLElement) => void;
    toggleAdminService?: (type: "early" | "late") => void;
    recalculateFromManual?: (isDiscountEdited?: boolean) => void;
    markDrawerSessionSaved?: () => void;
  }
}
