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
  syncJournalTotals,
} from "@/lib/admin/bookingPayments";
import {
  defaultSpecialTariffState,
  enabledSpecialTariffIds,
  listActiveSpecialTariffDiscounts,
  type SpecialTariffToggle,
} from "@/lib/admin/specialTariffBooking";
import {
  destroyDrawerDatePickers,
  initDrawerDatePickers,
  syncDrawerDatePickers,
} from "./drawerDatePickers";
import type { FlatpickrInstance } from "./flatpickrAdmin";
import type { AdminSettingsPayload, BookingRecord, RoomConfig } from "./types";
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
};

export function useBookingDrawer({
  bookings,
  settings,
  editingRowRef,
  earlyTimeRef,
  lateTimeRef,
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

  const checkInPickerRef = useRef<FlatpickrInstance | null>(null);
  const checkOutPickerRef = useRef<FlatpickrInstance | null>(null);
  const datesSyncSkipRef = useRef(false);
  const formDatesRef = useRef({ checkIn: form.checkIn, checkOut: form.checkOut });
  formDatesRef.current = { checkIn: form.checkIn, checkOut: form.checkOut };

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
      roomsList.find((r) => r.name === form.cottage) ||
      (form.roomId != null ? roomsList.find((r) => String(r.id) === String(form.roomId)) : undefined);
    return listServicesForRoom(settings.customServicesList, room);
  }, [form.cottage, form.roomId, roomsList, settings.customServicesList]);

  const maxOccupants = useMemo(
    () => getRoomMaxCapacity(form.cottage, roomsList),
    [form.cottage, roomsList]
  );

  const showChildren = true;

  const selectedRoomForPolicy = useMemo(() => {
    return (
      roomsList.find((r) => r.name === form.cottage) ||
      (form.roomId != null ? roomsList.find((r) => String(r.id) === String(form.roomId)) : undefined)
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

  const closeDrawer = useCallback(() => {
    if (typeof document !== "undefined") {
      document.getElementById("bookingDrawer")?.classList.remove("active");
    }
    setDrawerOpen(false);
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

  const syncCottageUi = useCallback(
    (roomName: string) => {
      const holding = roomName === "Нерозподілені";
      window._bookingAssignmentState = holding ? "holding" : "assigned";
      const room = roomsList.find((r) => r.name === roomName);
      setForm((prev) => {
        const { adults, children: rawChildren } = clampOccupantsForRoom(
          prev.guests,
          prev.children,
          roomName,
          roomsList
        );
        return {
          ...prev,
          cottage: roomName,
          cottageLabel: roomName ? formatRoomDisplayLabel(roomName, room?.desc) : "Оберіть котедж",
          roomId: holding ? null : room?.id ?? null,
          guests: adults,
          children: rawChildren,
        };
      });
    },
    [roomsList]
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
        [...list.map((r) => ({ name: r.name, desc: r.desc })), { name: "Нерозподілені", desc: "Без будинку" }],
        (name, display) => {
          selectOption("cottageWrapper", "adminCottage", name, null, display);
          syncCottageUi(name);
        }
      );
    },
    [roomsList, syncCottageUi]
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
        prefillRoom === "Нерозподілені" ? "holding" : "assigned";

      const activeRooms = roomsList.filter((r) => r.active);
      const defaultRoom = prefillRoom || activeRooms[0]?.name || "";
      const isHolding = defaultRoom === "Нерозподілені";
      const defaultRoomConfig =
        activeRooms.find((r) => r.name === defaultRoom) ?? activeRooms[0] ?? null;

      const checkIn = prefillDateStart ? normalizeDateToIso(prefillDateStart) : "";
      const checkOut = prefillDateEnd
        ? normalizeDateToIso(prefillDateEnd)
        : checkIn
          ? isoDatePlusDays(checkIn, 1)
          : "";

      window._bookingPayments = [];
      window._bookingPaymentMeta = { createdAt: checkIn || undefined, checkOut: checkOut || undefined };

      setForm({
        ...defaultBookingDrawerForm(),
        cottage: defaultRoom,
        cottageLabel: defaultRoom
          ? formatRoomDisplayLabel(defaultRoom, defaultRoomConfig?.desc)
          : "Оберіть котедж",
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
      const matchedRoom = findRoomForBooking(booking, roomsList);
      const savedRoom =
        booking.assignmentState === "holding"
          ? "Нерозподілені"
          : matchedRoom?.name || String(booking.cottage || "");
      const room = matchedRoom ?? roomsList.find((r) => r.name === savedRoom);
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
      const displayedStatus =
        booking.source === "Сайт" &&
        booking.status === "Підтверджено" &&
        savedPaymentTotals.paidAmount === 0
          ? "Очікує оплату"
          : booking.status || "Нова бронь";

      setInitialPayment({
        prepay: savedPrepay,
        surcharge: savedSurcharge,
        prepayMethod: savedPaymentTotals.prepayMethod,
        surchargeMethod: savedPaymentTotals.surchargeMethod,
      });
      window._bookingOpenPayments = { prepay: savedPrepay, surcharge: savedSurcharge };
      window._bookingExpectedPrepay = Number(booking.prepayAmount) || 0;
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
        roomsList
      );

      setForm({
        ...defaultBookingDrawerForm(),
        name: String(booking.name).replace(" (Ручна бронь)", ""),
        phone: `+${formatPhone(booking.phone)}`,
        source: booking.source || "Адмінка",
        comment: parsed.guestComment,
        cottage: savedRoom,
        cottageLabel: savedRoom ? formatRoomDisplayLabel(savedRoom, room?.desc) : "Оберіть котедж",
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
    (status: "Нова бронь" | "Очікує оплату" | "Підтверджено") => {
      if (form.status === "Скасовано") return;
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
    if (!drawerOpen || typeof document === "undefined") return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const { checkIn, checkOut } = formDatesRef.current;
      const pickers = initDrawerDatePickers({
        checkIn,
        checkOut,
        onCheckInChange: (iso) => {
          datesSyncSkipRef.current = true;
          patchForm({ checkIn: iso });
          bumpPrice();
        },
        onCheckOutChange: (iso) => {
          datesSyncSkipRef.current = true;
          patchForm({ checkOut: iso });
          bumpPrice();
        },
      });
      if (pickers) {
        checkInPickerRef.current = pickers.checkIn;
        checkOutPickerRef.current = pickers.checkOut;
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      destroyDrawerDatePickers(checkInPickerRef.current, checkOutPickerRef.current);
      checkInPickerRef.current = null;
      checkOutPickerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ініціалізація flatpickr лише при відкритті drawer
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || datesSyncSkipRef.current) {
      datesSyncSkipRef.current = false;
      return;
    }
    syncDrawerDatePickers(
      checkInPickerRef.current,
      checkOutPickerRef.current,
      form.checkIn,
      form.checkOut
    );
  }, [drawerOpen, form.checkIn, form.checkOut]);

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
  }
}
