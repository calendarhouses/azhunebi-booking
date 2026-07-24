"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Clock3, Home, PawPrint, Percent, Tag, Users } from "lucide-react";
import { BookingQuickEditDrawer } from "../mobile/BookingQuickEditDrawer";
import { BookingFormSectionHeading } from "./BookingFormSectionHeading";
import { useMobileUi } from "../mobile/MobileUiContext";
import { HOLDING_ROOM } from "./timelineBookingMove";
import { nightWord } from "./adminPlural";
import { showToast } from "./adminGlobals";
import { findRoomForBooking } from "./bookingUtils";
import type {
  BookingPriceFormInput,
  SchedulePriceLabels,
} from "./bookingDrawerForm";
import {
  computeBookingPrice,
  type FormStateSnapshot,
  type ManualPriceSnapshot,
} from "./bookingPriceEngine";
import { formatFlexibleScheduleCardLabel } from "@/lib/admin/flexibleSchedule";
import type { AdminSettingsPayload, BookingPayment, BookingRecord } from "./types";
import { PaymentJournalSection } from "./PaymentJournalSection";
import { IntegerAmountInput } from "../shared/IntegerAmountInput";
import { PriceLineInput } from "../shared/PriceLineInput";
import {
  applyManualDiscountOverrides,
  calculateTotal,
  clampDiscountAmount,
  computeDiscountLineMax,
  formatAppliedDiscountLabel,
  resolveApplicableBookingDiscounts,
  type DiscountLineResult,
} from "@/lib/admin/bookingDiscountCalc";
import { enabledSpecialTariffIds as pickEnabledSpecialTariffIds } from "@/lib/admin/specialTariffBooking";
import { getDiscountKindBadgeClassByKind } from "./settings/discountConfig";
import {
  formatDateIso,
  getBookingPayments,
  mergeTopFieldsIntoJournal,
  syncJournalTotals,
} from "@/lib/admin/bookingPayments";
import {
  calculatePrepaymentAmount,
  readPrepaymentPolicy,
} from "@/lib/public-booking/prepaymentPolicy";
import type { PublicBranding } from "@/lib/public-booking/types";

export type BookingPricingSnapshot = {
  totalPrice: number;
  prepay: number;
  surcharge: number;
  prepayMethod: string;
  surchargeMethod: string;
  basePrice: number;
  extraGuestFee: number;
  petFee: number;
  dayGuestFee: number;
  earlyFee: number;
  lateFee: number;
  discountAmount: number;
  discountEdited: boolean;
};

export interface BookingPriceCalculatorProps {
  form: BookingPriceFormInput;
  isInitialLoad: boolean;
  onInitialLoadDone: () => void;
  settings: AdminSettingsPayload;
  bookings: BookingRecord[];
  editingRow: number | string | null;
  selectedEarlyTime: string | null;
  selectedLateTime: string | null;
  editingBookingId?: string | null;
  onGuestsChange?: (guests: number) => void;
  onOverlapChange?: (isOverlap: boolean) => void;
  onScheduleLabelsChange?: (labels: SchedulePriceLabels) => void;
  onPricingSnapshotChange?: (snapshot: BookingPricingSnapshot | null) => void;
  onStatusFromPayment?: (
    status: "Очікує оплату" | "Підтверджено"
  ) => void;
  initialPrepay?: number;
  initialSurcharge?: number;
  initialPrepayMethod?: string;
  initialSurchargeMethod?: string;
  bookingStatus?: string;
  /** Сума базової вартості з розбивки по ночах (коли адмін редагує окремі дати). */
  nightlyBaseSum?: number | null;
  onClearNightlyPriceOverrides?: () => void;
  instantDiscountAmount?: number;
  onInstantDiscountHydrate?: (amount: number) => void;
}

type ManualLineKey = keyof Pick<
  ManualPriceSnapshot,
  "base" | "extra" | "pet" | "dayGuest" | "early" | "late" | "discount"
>;

const iconBase = <Home size={12} strokeWidth={2} />;
const iconUsers = <Users size={12} strokeWidth={2} />;
const iconPaw = <PawPrint size={12} strokeWidth={2} />;
const iconClock = <Clock3 size={12} strokeWidth={2} />;
const iconVat = (
  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4h10v2a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V4zM8 12h8M9 16h6M10 20h4" />
  </svg>
);

export function BookingPriceCalculator({
  form,
  isInitialLoad,
  onInitialLoadDone,
  settings,
  bookings,
  editingRow,
  selectedEarlyTime,
  selectedLateTime,
  editingBookingId = null,
  onGuestsChange,
  onOverlapChange,
  onScheduleLabelsChange,
  onPricingSnapshotChange,
  onStatusFromPayment,
  initialPrepay = 0,
  initialSurcharge = 0,
  initialPrepayMethod = "ФОП",
  initialSurchargeMethod = "Готівка",
  bookingStatus = "Очікує оплату",
  nightlyBaseSum = null,
  onClearNightlyPriceOverrides,
  instantDiscountAmount = 0,
  onInstantDiscountHydrate,
}: BookingPriceCalculatorProps) {
  const isMobile = useMobileUi();
  const prevFormRef = useRef<FormStateSnapshot | null>(null);
  const [quickEdit, setQuickEdit] = useState<{
    title: string;
    value: number;
    defaultValue: number;
    maxAmount?: number;
    onSave: (v: number) => void;
    sign?: "+" | "-";
  } | null>(null);
  const [manual, setManual] = useState<ManualPriceSnapshot>({
    base: null,
    extra: null,
    pet: null,
    dayGuest: null,
    early: null,
    late: null,
    discount: null,
    discountEdited: false,
  });
  const [manualLines, setManualLines] = useState<Record<ManualLineKey, number>>({
    base: 0,
    extra: 0,
    pet: 0,
    dayGuest: 0,
    early: 0,
    late: 0,
    discount: 0,
  });
  const [totalOverride, setTotalOverride] = useState<number | null>(null);
  const [prepay, setPrepay] = useState(initialPrepay);
  const [surcharge, setSurcharge] = useState(initialSurcharge);
  const [prepayMethod, setPrepayMethod] = useState(initialPrepayMethod);
  const [surchargeMethod, setSurchargeMethod] = useState(initialSurchargeMethod);
  const [manualDiscountAmounts, setManualDiscountAmounts] = useState<Record<string, number>>({});
  const [editedDiscountIds, setEditedDiscountIds] = useState<Set<string>>(() => new Set());

  const room = useMemo(() => {
    if (form.cottage === "Нерозподілені") return HOLDING_ROOM;
    return (
      findRoomForBooking(
        { cottage: form.cottage, roomId: form.roomId ?? undefined },
        settings.roomsList || []
      ) ?? undefined
    );
  }, [settings.roomsList, form.cottage, form.roomId]);

  const guestsForCalc = useMemo(() => {
    if (!room) return form.guests;
    const maxCap = room.maxCapacity || room.capacity || 10;
    if (form.guests > maxCap) return maxCap;
    return Math.max(1, form.guests);
  }, [form.guests, room]);

  useEffect(() => {
    if (!room || form.guests <= (room.maxCapacity || room.capacity || 10)) return;
    const maxCap = room.maxCapacity || room.capacity || 10;
    showToast(`Кількість гостей зменшено до максимуму (${maxCap})`);
    onGuestsChange?.(maxCap);
  }, [form.guests, room, onGuestsChange]);

  const savedBooking = useMemo(() => {
    if (editingRow == null) return null;
    if (editingBookingId) {
      return bookings.find((b) => String(b.id) === String(editingBookingId)) ?? null;
    }
    return bookings.find((b) => String(b.row) === String(editingRow)) ?? null;
  }, [bookings, editingRow, editingBookingId]);

  useEffect(() => {
    if (form.cottage === "Нерозподілені" && savedBooking) {
      setTotalOverride(Number(savedBooking.totalPrice) || 0);
    }
  }, [form.cottage, savedBooking]);

  const activeSpecialTariffIds = useMemo(
    () => pickEnabledSpecialTariffIds(form.specialTariffs || {}),
    [form.specialTariffs]
  );

  const computed = useMemo(() => {
    const result = computeBookingPrice({
      checkInStr: form.checkIn,
      checkOutStr: form.checkOut,
      roomName: form.cottage,
      guests: guestsForCalc,
      children: form.children,
      pets: form.pets,
      dayGuests: form.dayGuests,
      isVat: form.vat === "Так",
      selectedServices: form.selectedServices,
      promoCode: form.promoCode,
      enabledSpecialTariffIds: activeSpecialTariffIds,
      selectedEarlyTime,
      selectedLateTime,
      room,
      settings,
      allBookings: bookings,
      editingRow,
      editingId: editingBookingId,
      isInitialLoad,
      manual,
      prevForm: prevFormRef.current,
      savedBooking,
    });

    const curr: FormStateSnapshot = {
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      cottage: form.cottage,
      guests: guestsForCalc,
      pets: form.pets,
      dayGuests: form.dayGuests,
      early: selectedEarlyTime,
      late: selectedLateTime,
    };
    if (!isInitialLoad) prevFormRef.current = curr;

    return result;
  }, [
    form,
    guestsForCalc,
    selectedEarlyTime,
    selectedLateTime,
    room,
    settings,
    bookings,
    editingRow,
    editingBookingId,
    isInitialLoad,
    manual,
    savedBooking,
    activeSpecialTariffIds,
  ]);

  useEffect(() => {
    if (computed.empty) return;
    const baseFromNights =
      nightlyBaseSum != null && Number.isFinite(nightlyBaseSum) ? nightlyBaseSum : null;
    setManualLines((prev) => ({
      ...prev,
      base: baseFromNights ?? computed.basePriceTotal,
      extra: computed.extraGuestFee,
      pet: computed.petFee,
      dayGuest: computed.dayGuestFee,
      early: computed.earlyFee,
      late: computed.lateFee,
    }));
  }, [
    computed.empty,
    computed.basePriceTotal,
    computed.extraGuestFee,
    computed.petFee,
    computed.dayGuestFee,
    computed.earlyFee,
    computed.lateFee,
    nightlyBaseSum,
  ]);

  useEffect(() => {
    if (editingRow == null) {
      prevFormRef.current = null;
      setManual({
        base: null,
        extra: null,
        pet: null,
        dayGuest: null,
        early: null,
        late: null,
        discount: null,
        discountEdited: false,
      });
      setTotalOverride(null);
      setManualDiscountAmounts({});
      setEditedDiscountIds(new Set());
      if (!isInitialLoad) {
        setPrepay(0);
        setSurcharge(0);
      }
    }
  }, [editingRow, isInitialLoad]);

  useEffect(() => {
    if (isInitialLoad) onInitialLoadDone();
  }, [isInitialLoad, onInitialLoadDone]);

  const scheduleLabels = useMemo((): SchedulePriceLabels => {
    const hasDates = !computed.empty;
    return {
      early: formatFlexibleScheduleCardLabel("early", settings, {
        selectedTime: selectedEarlyTime,
        billableFee: computed.earlyFee,
        quotedFee: computed.earlyQuotedFee,
        hasDates,
      }),
      late: formatFlexibleScheduleCardLabel("late", settings, {
        selectedTime: selectedLateTime,
        billableFee: computed.lateFee,
        quotedFee: computed.lateQuotedFee,
        hasDates,
      }),
    };
  }, [
    computed.empty,
    computed.earlyFee,
    computed.earlyQuotedFee,
    computed.lateFee,
    computed.lateQuotedFee,
    selectedEarlyTime,
    selectedLateTime,
    settings,
  ]);

  const scheduleLabelsRef = useRef<SchedulePriceLabels | null>(null);
  useEffect(() => {
    const prev = scheduleLabelsRef.current;
    if (prev?.early === scheduleLabels.early && prev?.late === scheduleLabels.late) return;
    scheduleLabelsRef.current = scheduleLabels;
    onScheduleLabelsChange?.(scheduleLabels);
  }, [scheduleLabels, onScheduleLabelsChange]);

  const overlapRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (overlapRef.current === computed.isOverlap) return;
    overlapRef.current = computed.isOverlap;
    onOverlapChange?.(computed.isOverlap);
  }, [computed.isOverlap, onOverlapChange]);

  useEffect(() => {
    const w = window as Window & { selectedPostLateArrivalTime?: string | null };
    w.selectedPostLateArrivalTime = computed.isPostLateGapStay
      ? computed.postLateArrivalTime
      : null;
    return () => {
      if (!computed.isPostLateGapStay) return;
      // Keep value until next calculator pass / drawer close clears it.
    };
  }, [
    computed.isPostLateGapStay,
    computed.postLateArrivalTime,
  ]);

  const amountToDiscount = manualLines.base + manualLines.extra;

  useEffect(() => {
    setManualDiscountAmounts({});
    setEditedDiscountIds(new Set());
  }, [form.checkIn, form.checkOut, form.cottage, activeSpecialTariffIds]);

  const autoDiscounts = useMemo(
    () =>
      computed.empty || !room
        ? []
        : resolveApplicableBookingDiscounts(
            settings.discountsList || [],
            {
              checkIn: form.checkIn,
              checkOut: form.checkOut,
              nights: computed.nights,
              roomId: String(room.id),
              enabledSpecialTariffIds: activeSpecialTariffIds,
              promoCode: form.promoCode,
            },
            amountToDiscount
          ),
    [
      activeSpecialTariffIds,
      amountToDiscount,
      computed.empty,
      computed.nights,
      form.checkIn,
      form.checkOut,
      form.promoCode,
      room,
      settings.discountsList,
    ]
  );

  const autoDiscountBreakdown = useMemo(
    () => calculateTotal(amountToDiscount, autoDiscounts),
    [amountToDiscount, autoDiscounts]
  );

  const discountBreakdown = useMemo(() => {
    const overrides: Record<string, number> = {};
    for (const line of autoDiscountBreakdown.lines) {
      if (!editedDiscountIds.has(line.discount.id)) continue;
      const manual = manualDiscountAmounts[line.discount.id];
      if (manual === undefined) continue;
      const maxForLine = computeDiscountLineMax(
        line.discount.id,
        amountToDiscount,
        autoDiscountBreakdown.lines,
        manualDiscountAmounts,
        editedDiscountIds
      );
      overrides[line.discount.id] = clampDiscountAmount(manual, maxForLine);
    }
    return applyManualDiscountOverrides(autoDiscountBreakdown, overrides);
  }, [amountToDiscount, autoDiscountBreakdown, editedDiscountIds, manualDiscountAmounts]);

  useEffect(() => {
    const autoIds = new Set(autoDiscountBreakdown.lines.map((line) => line.discount.id));
    setEditedDiscountIds((prev) => {
      const next = new Set([...prev].filter((id) => autoIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [autoDiscountBreakdown.lines]);

  const extrasTotal = manualLines.pet + manualLines.dayGuest + manualLines.early + manualLines.late;

  const instantDiscount = Math.max(0, Math.round(instantDiscountAmount));
  const autoTotal = Math.max(0, discountBreakdown.total - instantDiscount + extrasTotal);

  const discountHydratedRef = useRef<string | null>(null);
  useEffect(() => {
    discountHydratedRef.current = null;
  }, [editingBookingId, editingRow]);

  useEffect(() => {
    const key = `${editingBookingId ?? ""}:${editingRow ?? ""}`;
    if (discountHydratedRef.current === key) return;
    if (isInitialLoad) return;
    if (!onInstantDiscountHydrate) {
      discountHydratedRef.current = key;
      return;
    }
    const savedDisc = savedBooking ? Math.round(Number(savedBooking.discountAmount) || 0) : 0;
    const residual = savedBooking
      ? Math.max(0, savedDisc - discountBreakdown.discountSum)
      : 0;
    discountHydratedRef.current = key;
    // Always overwrite — parent may still hold a stale instant from the previous booking.
    onInstantDiscountHydrate(residual);
  }, [
    discountBreakdown.discountSum,
    editingBookingId,
    editingRow,
    isInitialLoad,
    onInstantDiscountHydrate,
    savedBooking,
  ]);

  const handleDiscountAmountChange = useCallback(
    (discountId: string, amount: number) => {
      const nextEdited = new Set(editedDiscountIds);
      nextEdited.add(discountId);
      const draftAmounts = { ...manualDiscountAmounts, [discountId]: amount };
      const maxForLine = computeDiscountLineMax(
        discountId,
        amountToDiscount,
        autoDiscountBreakdown.lines,
        draftAmounts,
        nextEdited
      );
      const clamped = clampDiscountAmount(amount, maxForLine);
      setEditedDiscountIds(nextEdited);
      setManualDiscountAmounts((prev) => ({ ...prev, [discountId]: clamped }));
      setManual((prev) => ({ ...prev, discountEdited: true, discount: null }));
    },
    [amountToDiscount, autoDiscountBreakdown.lines, editedDiscountIds, manualDiscountAmounts]
  );

  useEffect(() => {
    if (computed.empty || computed.isOverlap) return;
    const sum = discountBreakdown.discountSum + instantDiscount;
    setManualLines((prev) => ({ ...prev, discount: sum }));
    const hasDiscountEdits = editedDiscountIds.size > 0 || instantDiscount > 0;
    setManual((prev) => ({
      ...prev,
      discountEdited: hasDiscountEdits,
      discount: hasDiscountEdits ? sum : null,
    }));
  }, [
    computed.empty,
    computed.isOverlap,
    discountBreakdown.discountSum,
    editedDiscountIds.size,
    instantDiscount,
    manual.discountEdited,
  ]);

  useEffect(() => {
    if (isInitialLoad) return;
    setTotalOverride(null);
  }, [autoTotal, isInitialLoad]);

  const hasManualDiscountEdits = editedDiscountIds.size > 0 || manual.discountEdited || instantDiscount > 0;

  const displayTotal =
    totalOverride !== null && !isInitialLoad
      ? totalOverride
      : isInitialLoad && !hasManualDiscountEdits
        ? computed.totalPrice
        : autoTotal;

  const prepayPolicy = useMemo(
    () => readPrepaymentPolicy((settings.branding || {}) as PublicBranding),
    [settings.branding]
  );

  const policyPrepayAmount = useMemo(() => {
    const checkIn = form.checkIn ? new Date(form.checkIn) : null;
    const checkOut = form.checkOut ? new Date(form.checkOut) : null;
    const nights =
      checkIn && checkOut && !isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())
        ? Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000))
        : 1;
    const base = Math.max(
      0,
      Math.round(Number(manualLines.base) || amountToDiscount || displayTotal)
    );
    return calculatePrepaymentAmount(prepayPolicy, {
      totalPrice: Math.max(0, Math.round(displayTotal)),
      basePriceTotal: base > 0 ? base : Math.max(0, Math.round(displayTotal)),
      nights,
      nightlyBasePrices: computed.nightlyBasePrices,
    });
  }, [
    prepayPolicy,
    form.checkIn,
    form.checkOut,
    manualLines.base,
    amountToDiscount,
    displayTotal,
    computed.nightlyBasePrices,
  ]);

  useEffect(() => {
    if (computed.empty || computed.isOverlap) {
      onPricingSnapshotChange?.(null);
      return;
    }
    // Auto total must follow current calculation.
    // Override is used only when user edits total manually.
    if (totalOverride === null) return;
    if (isInitialLoad) {
      setTotalOverride(null);
    }
  }, [
    computed.empty,
    computed.isOverlap,
    computed.totalPrice,
    isInitialLoad,
    onPricingSnapshotChange,
    totalOverride,
  ]);

  useEffect(() => {
    if (computed.empty || computed.isOverlap) return;
    onPricingSnapshotChange?.({
      totalPrice: displayTotal,
      prepay,
      surcharge,
      prepayMethod,
      surchargeMethod,
      basePrice: manualLines.base,
      extraGuestFee: manualLines.extra,
      petFee: manualLines.pet,
      dayGuestFee: manualLines.dayGuest,
      earlyFee: manualLines.early,
      lateFee: manualLines.late,
      discountAmount: manualLines.discount,
      discountEdited: manual.discountEdited,
    });
  }, [
    computed.empty,
    computed.isOverlap,
    displayTotal,
    prepay,
    surcharge,
    prepayMethod,
    surchargeMethod,
    manualLines,
    manual.discountEdited,
    onPricingSnapshotChange,
  ]);

  const paymentStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (bookingStatus === "Скасовано" || bookingStatus === "Закрито") return;
    const paid = prepay + surcharge;
    const next = paid > 0 ? "Підтверджено" : "Очікує оплату";
    if (paymentStatusRef.current === next) return;
    paymentStatusRef.current = next;
    onStatusFromPayment?.(next);
  }, [prepay, surcharge, bookingStatus, onStatusFromPayment]);

  useEffect(() => {
    setPrepay(initialPrepay);
    setSurcharge(initialSurcharge);
    setPrepayMethod(initialPrepayMethod);
    setSurchargeMethod(initialSurchargeMethod);
  }, [initialPrepay, initialSurcharge, initialPrepayMethod, initialSurchargeMethod]);

  const [payments, setPayments] = useState<BookingPayment[]>([]);
  const paymentsBootKey = `${editingRow ?? "new"}:${editingBookingId ?? ""}`;

  useEffect(() => {
    if (savedBooking) {
      setPayments(getBookingPayments(savedBooking));
    } else {
      setPayments([]);
    }
  }, [paymentsBootKey, savedBooking]);

  useEffect(() => {
    const w = window as Window & {
      _bookingPayments?: BookingPayment[];
      _bookingPaymentMeta?: { createdAt?: string; checkOut?: string };
    };
    w._bookingPayments = payments;
    w._bookingPaymentMeta = {
      createdAt: savedBooking?.createdAt
        ? String(savedBooking.createdAt).substring(0, 10)
        : form.checkIn || formatDateIso(new Date()),
      checkOut: form.checkOut || "",
    };
  }, [payments, form.checkIn, form.checkOut, savedBooking?.createdAt]);

  const handlePaymentsChange = useCallback((next: BookingPayment[]) => {
    setPayments(next);
    const synced = syncJournalTotals(next);
    setPrepay(synced.prepay);
    setSurcharge(synced.surcharge);
    setPrepayMethod(synced.prepayMethod);
    setSurchargeMethod(synced.surchargeMethod);
  }, []);

  const syncTopFieldsToJournal = useCallback(
    (
      nextPrepay: number,
      nextSurcharge: number,
      nextPrepayMethod: string,
      nextSurchargeMethod: string
    ) => {
      setPayments((prev) =>
        mergeTopFieldsIntoJournal(
          prev,
          nextPrepay,
          nextSurcharge,
          nextPrepayMethod,
          nextSurchargeMethod
        )
      );
    },
    []
  );

  const onPrepayChange = useCallback(
    (value: number) => {
      setPrepay(value);
      syncTopFieldsToJournal(value, surcharge, prepayMethod, surchargeMethod);
    },
    [surcharge, prepayMethod, surchargeMethod, syncTopFieldsToJournal]
  );

  const onSurchargeChange = useCallback(
    (value: number) => {
      setSurcharge(value);
      syncTopFieldsToJournal(prepay, value, prepayMethod, surchargeMethod);
    },
    [prepay, prepayMethod, surchargeMethod, syncTopFieldsToJournal]
  );

  const onPrepayMethodChange = useCallback(
    (method: string) => {
      setPrepayMethod(method);
      syncTopFieldsToJournal(prepay, surcharge, method, surchargeMethod);
    },
    [prepay, surcharge, surchargeMethod, syncTopFieldsToJournal]
  );

  const onSurchargeMethodChange = useCallback(
    (method: string) => {
      setSurchargeMethod(method);
      syncTopFieldsToJournal(prepay, surcharge, prepayMethod, method);
    },
    [prepay, surcharge, prepayMethod, syncTopFieldsToJournal]
  );

  const onManualRecalc = useCallback(
    (_discountEdited = false, overrides?: Partial<Record<ManualLineKey, number>>) => {
      const lines = { ...manualLines, ...overrides };
      const taxable = lines.base + lines.extra;
      const autoDisc = calculateTotal(taxable, autoDiscounts);
      const discountOverrides: Record<string, number> = {};
      for (const line of autoDisc.lines) {
        if (!editedDiscountIds.has(line.discount.id)) continue;
        const manual = manualDiscountAmounts[line.discount.id];
        if (manual === undefined) continue;
        const maxForLine = computeDiscountLineMax(
          line.discount.id,
          taxable,
          autoDisc.lines,
          manualDiscountAmounts,
          editedDiscountIds
        );
        discountOverrides[line.discount.id] = clampDiscountAmount(manual, maxForLine);
      }
      const discountResult = applyManualDiscountOverrides(autoDisc, discountOverrides);
      const total =
        discountResult.total +
        lines.pet +
        lines.dayGuest +
        lines.early +
        lines.late -
        instantDiscount;
      setManualLines((m) => ({
        ...m,
        ...overrides,
        discount: discountResult.discountSum + instantDiscount,
      }));
      setTotalOverride(total);
    },
    [autoDiscounts, editedDiscountIds, instantDiscount, manualDiscountAmounts, manualLines]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.recalculateFromManual = (flag?: boolean) => onManualRecalc(!!flag);
    return () => {
      delete window.recalculateFromManual;
    };
  }, [onManualRecalc]);

  useEffect(() => {
    if (nightlyBaseSum == null || !Number.isFinite(nightlyBaseSum)) return;
    onManualRecalc(false, { base: nightlyBaseSum });
  }, [nightlyBaseSum, onManualRecalc]);

  if (!form.checkIn || !form.checkOut || !form.cottage || !room) {
    return null;
  }

  if (computed.isOverlap) {
    return (
      <div
        className="form-section"
        style={{ background: "#FEF2F2", borderColor: "#EF4444", padding: "30px 20px" }}
      >
        <div
          style={{
            color: "#DC2626",
            fontWeight: "bold",
            fontSize: 15,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          ОБЕРЕЖНО: ОВЕРБУКІНГ!
          <span
            style={{ fontSize: 13, fontWeight: 500, color: "#991B1B" }}
            dangerouslySetInnerHTML={{ __html: computed.overlapReason }}
          />
        </div>
      </div>
    );
  }

  const balance = displayTotal - prepay - surcharge;
  const balanceStyle =
    balance <= 0
      ? { color: "#059669", background: "#D1FAE5", borderColor: "#A7F3D0" }
      : { color: "#DC2626", background: "#FEE2E2", borderColor: "#FECACA" };
  const balanceText = balance <= 0 ? "Оплачено повністю (0 грн)" : `${balance} грн`;

  return (
    <>
    <div className="form-section" style={{ background: "#FDFCFB", borderColor: "var(--accent)" }}>
      {computed.postLateGapNoticeHtml ? (
        <div
          className="admin-postlate-notice"
          style={{
            marginBottom: 14,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#F4F7EE",
            border: "1px solid #C9D6B0",
            color: "#3F4A2E",
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.45,
          }}
          dangerouslySetInnerHTML={{ __html: computed.postLateGapNoticeHtml }}
        />
      ) : null}
      {computed.restrWarningHtml ? (
        <div dangerouslySetInnerHTML={{ __html: computed.restrWarningHtml }} />
      ) : null}
      <BookingFormSectionHeading
        accent
        title={`Розшифровка · ${computed.nights} ${nightWord(computed.nights)}`}
      />

      <PriceLine
        label="Базова вартість:"
        icon={iconBase}
        value={manualLines.base}
        defaultValue={computed.basePriceTotal}
        isMobile={isMobile}
        onOpenQuickEdit={setQuickEdit}
        onChange={(v) => {
          onClearNightlyPriceOverrides?.();
          setManualLines((m) => ({ ...m, base: v }));
          onManualRecalc(false, { base: v });
        }}
      />
      {computed.extraGuestFee > 0 ? (
        <PriceLine
          label="Дод. гості:"
          icon={iconUsers}
          value={manualLines.extra}
          defaultValue={computed.extraGuestFee}
          sign="+"
          isMobile={isMobile}
          onOpenQuickEdit={setQuickEdit}
          onChange={(v) => {
            setManualLines((m) => ({ ...m, extra: v }));
            onManualRecalc(false, { extra: v });
          }}
        />
      ) : null}
      {computed.serviceLines.length > 0
        ? computed.serviceLines
            .filter((line) => line.quantity > 0 && line.fee > 0)
            .map((line) => (
              <PriceLine
                key={line.id}
                label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ""}:`}
                icon={iconUsers}
                value={line.fee}
                defaultValue={line.fee}
                sign="+"
                isMobile={isMobile}
                onOpenQuickEdit={setQuickEdit}
                onChange={() => undefined}
              />
            ))
        : null}
      {computed.serviceLines.length === 0 && computed.petFee > 0 ? (
        <PriceLine
          label="Тварини:"
          icon={iconPaw}
          value={manualLines.pet}
          defaultValue={computed.petFee}
          sign="+"
          isMobile={isMobile}
          onOpenQuickEdit={setQuickEdit}
          onChange={(v) => {
            setManualLines((m) => ({ ...m, pet: v }));
            onManualRecalc(false, { pet: v });
          }}
        />
      ) : null}
      {computed.serviceLines.length === 0 && computed.dayGuestFee > 0 ? (
        <PriceLine
          label="Денні гості:"
          icon={iconUsers}
          value={manualLines.dayGuest}
          defaultValue={computed.dayGuestFee}
          sign="+"
          isMobile={isMobile}
          onOpenQuickEdit={setQuickEdit}
          onChange={(v) => {
            setManualLines((m) => ({ ...m, dayGuest: v }));
            onManualRecalc(false, { dayGuest: v });
          }}
        />
      ) : null}
      {selectedEarlyTime ? (
        <PriceLine
          label="Ранній заїзд"
          icon={iconClock}
          meta={`(з ${selectedEarlyTime})`}
          value={manualLines.early}
          defaultValue={computed.earlyFee}
          sign="+"
          isMobile={isMobile}
          onOpenQuickEdit={setQuickEdit}
          onChange={(v) => {
            setManualLines((m) => ({ ...m, early: v }));
            onManualRecalc(false, { early: v });
          }}
        />
      ) : null}
      {selectedLateTime ? (
        <PriceLine
          label="Пізній виїзд"
          icon={iconClock}
          meta={`(до ${selectedLateTime})`}
          value={manualLines.late}
          defaultValue={computed.lateFee}
          sign="+"
          isMobile={isMobile}
          onOpenQuickEdit={setQuickEdit}
          onChange={(v) => {
            setManualLines((m) => ({ ...m, late: v }));
            onManualRecalc(false, { late: v });
          }}
        />
      ) : null}

      {discountBreakdown.lines.length > 0 ? (
        <div className="booking-discount-breakdown">
          {discountBreakdown.lines.map((line) => {
            const autoLine = autoDiscountBreakdown.lines.find((l) => l.discount.id === line.discount.id);
            const isEdited = editedDiscountIds.has(line.discount.id);
            const displayAmount =
              isEdited && manualDiscountAmounts[line.discount.id] !== undefined
                ? manualDiscountAmounts[line.discount.id]!
                : line.amount;
            const maxForLine = computeDiscountLineMax(
              line.discount.id,
              amountToDiscount,
              autoDiscountBreakdown.lines,
              manualDiscountAmounts,
              editedDiscountIds
            );
            return (
              <DiscountBreakdownLine
                key={line.discount.id}
                line={line}
                amount={displayAmount}
                defaultAmount={autoLine?.amount ?? line.amount}
                maxAmount={maxForLine}
                isMobile={isMobile}
                onOpenQuickEdit={setQuickEdit}
                onChange={(value) => handleDiscountAmountChange(line.discount.id, value)}
              />
            );
          })}
        </div>
      ) : null}

      {form.vat === "Так" && computed.serviceLines.length === 0 ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
            paddingTop: 8,
            borderTop: "1px solid #F3F4F6",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: "1 1 auto",
              minWidth: 0,
              fontSize: 13,
              color: "#4B5563",
              fontWeight: 500,
            }}
          >
            {iconVat} Чан:
          </span>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#1F2937" }}>Оплата на місці</span>
        </div>
      ) : null}
      {computed.serviceLines
        .filter((line) => line.quantity > 0 && line.onSite && line.fee === 0)
        .map((line) => (
          <div
            key={line.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
              paddingTop: 8,
              borderTop: "1px solid #F3F4F6",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flex: "1 1 auto",
                minWidth: 0,
                fontSize: 13,
                color: "#4B5563",
                fontWeight: 500,
              }}
            >
              {line.name}
              {line.pendingApproval ? " (запит)" : ""}:
            </span>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#1F2937" }}>Оплата на місці</span>
          </div>
        ))}

      <div style={{ borderTop: "2px solid var(--accent)", paddingTop: 15, marginTop: 16 }}>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
            До сплати (загальна вартість):
          </label>
          <IntegerAmountInput
            id="adminTotalPrice"
            value={displayTotal}
            onValueChange={(n) => setTotalOverride(n)}
            style={{
              fontWeight: 800,
              fontSize: 18,
              borderColor: "var(--accent)",
              background: "#F8FAF7",
              color: "#111827",
              width: "100%",
              boxSizing: "border-box",
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid var(--accent)",
              outline: "none",
            }}
          />
        </div>

        <div className="payment-block">
          <div className="pay-rows-stack">
            <div className="pay-row-block">
              <label>Передплата:</label>
              <div className="pay-amount-inwrap">
                <IntegerAmountInput
                  id="adminPrepayAmount"
                  value={prepay}
                  onValueChange={onPrepayChange}
                />
                <button
                  type="button"
                  className="pay-chip pay-quick-chip"
                  onClick={() => onPrepayChange(policyPrepayAmount)}
                  title="Передплата за правилами налаштувань"
                >
                  <span id="prepayBtnText">{policyPrepayAmount}</span>
                </button>
              </div>
              <PayMethods
                type="prepay"
                active={prepay > 0 ? prepayMethod : ""}
                onSelect={onPrepayMethodChange}
              />
              <input type="hidden" id="adminPrepayMethod" value={prepayMethod} readOnly />
            </div>
            <div className="pay-row-block">
              <label>Доплата на місці:</label>
              <div className="pay-amount-inwrap">
                <IntegerAmountInput
                  id="adminSurchargeAmount"
                  value={surcharge}
                  onValueChange={onSurchargeChange}
                />
                <button
                  type="button"
                  className="pay-chip pay-quick-chip pay-quick-chip-green"
                  onClick={() => onSurchargeChange(Math.max(0, displayTotal - prepay))}
                  title="Внести решту"
                >
                  Решта
                </button>
              </div>
              <PayMethods
                type="surcharge"
                active={surcharge > 0 ? surchargeMethod : ""}
                onSelect={onSurchargeMethodChange}
              />
              <input type="hidden" id="adminSurchargeMethod" value={surchargeMethod} readOnly />
            </div>
          </div>
          <div className="pay-balance-row">
            <label>Залишок (Борг):</label>
            <div id="adminBalance" style={balanceStyle}>
              {balanceText}
            </div>
          </div>
          <PaymentJournalSection
            payments={payments}
            onChange={handlePaymentsChange}
            defaultMethod={prepayMethod}
          />
        </div>
      </div>

      {/* Приховані поля для collectBookingFromForm (синхронізуються з useBookingDrawer) */}
      <input type="hidden" id="manualBasePrice" value={manualLines.base} readOnly />
      <input type="hidden" id="manualExtraGuest" value={manualLines.extra} readOnly />
      <input type="hidden" id="manualPet" value={manualLines.pet} readOnly />
      <input type="hidden" id="manualDayGuest" value={manualLines.dayGuest} readOnly />
      <input type="hidden" id="manualEarly" value={manualLines.early} readOnly />
      <input type="hidden" id="manualLate" value={manualLines.late} readOnly />
      <input type="hidden" id="manualDiscount" value={manualLines.discount} readOnly />
      <input type="hidden" id="hiddenBasePrice" value={computed.basePriceTotal} readOnly />
      <input type="hidden" id="hiddenExtraGuestFee" value={computed.extraGuestFee} readOnly />
      <input type="hidden" id="hiddenPetFee" value={computed.petFee} readOnly />
      <input type="hidden" id="hiddenDayGuestFee" value={computed.dayGuestFee} readOnly />
      <input type="hidden" id="hiddenEarlyFee" value={computed.earlyFee} readOnly />
      <input type="hidden" id="hiddenLateFee" value={computed.lateFee} readOnly />
      <input type="hidden" id="hiddenDiscountPercent" value={computed.discountPercent} readOnly />
      <input
        type="hidden"
        id="manualDiscountEdited"
        value={manual.discountEdited ? "true" : "false"}
        readOnly
      />

      {isMobile && quickEdit ? (
        <BookingQuickEditDrawer
          open
          title={quickEdit.title}
          value={quickEdit.value}
          defaultValue={quickEdit.defaultValue}
          maxAmount={quickEdit.maxAmount}
          onClose={() => setQuickEdit(null)}
          onSave={quickEdit.onSave}
        />
      ) : null}
    </div>
    </>
  );
}

type QuickEditOpener = (state: {
  title: string;
  value: number;
  defaultValue: number;
  maxAmount?: number;
  onSave: (v: number) => void;
  sign?: "+" | "-";
}) => void;

function DiscountBreakdownLine({
  line,
  amount,
  defaultAmount,
  maxAmount,
  isMobile,
  onOpenQuickEdit,
  onChange,
}: {
  line: DiscountLineResult;
  amount: number;
  defaultAmount: number;
  maxAmount: number;
  isMobile: boolean;
  onOpenQuickEdit: QuickEditOpener;
  onChange: (value: number) => void;
}) {
  const { discount } = line;
  const badgeClass = getDiscountKindBadgeClassByKind(discount.kind);
  const title = discount.titleName ?? discount.name;
  const conditionSuffix = discount.conditionSuffix;
  const editTitle = conditionSuffix ? `${title} | ${conditionSuffix}` : title;

  return (
    <div className="booking-discount-line">
      <span className="booking-discount-line__label">
        <span className="booking-discount-line__icon" aria-hidden>
          {discount.type === "percent" ? <Percent size={13} strokeWidth={2.25} /> : <Tag size={13} strokeWidth={2.25} />}
        </span>
        <span className="booking-discount-line__name">
          {title}
          {conditionSuffix ? (
            <span className="booking-discount-line__condition"> | {conditionSuffix}</span>
          ) : null}
        </span>
        <span className={`booking-discount-line__badge ${badgeClass}`}>
          {formatAppliedDiscountLabel(discount)}
        </span>
      </span>
      {isMobile ? (
        <button
          type="button"
          className="price-edit-wrapper danger booking-discount-line__edit"
          style={{ fontSize: 14 }}
          onClick={() =>
            onOpenQuickEdit({
              title: editTitle,
              value: amount,
              defaultValue: defaultAmount,
              maxAmount,
              onSave: onChange,
              sign: "-",
            })
          }
        >
          <span className="price-sign">−</span>
          <span className="editable-number">{amount.toLocaleString("uk-UA")}</span>
          <span className="price-edit-suffix">грн</span>
        </button>
      ) : (
        <div className="price-edit-wrapper danger booking-discount-line__edit" style={{ fontSize: 14 }}>
          <span className="price-sign">−</span>
          <PriceLineInput value={amount} onChange={onChange} danger maxAmount={maxAmount} />
          <span className="price-edit-suffix">грн</span>
        </div>
      )}
    </div>
  );
}

function PriceLine({
  label,
  icon,
  meta,
  value,
  defaultValue,
  sign,
  isMobile,
  onOpenQuickEdit,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  meta?: string;
  value: number;
  defaultValue: number;
  sign?: "+" | "-";
  isMobile: boolean;
  onOpenQuickEdit: QuickEditOpener;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: "1 1 auto",
          minWidth: 0,
          fontSize: 13,
          color: "#4B5563",
          fontWeight: 500,
        }}
      >
        {icon ? <span>{icon}</span> : null}
        {label}
        {meta ? <span style={{ color: "#9CA3AF", fontSize: 11 }}>{meta}</span> : null}
      </span>
      {isMobile ? (
        <button
          type="button"
          className="price-edit-wrapper"
          style={{ fontSize: 14 }}
          onClick={() =>
            onOpenQuickEdit({
              title: label,
              value,
              defaultValue,
              onSave: onChange,
              sign,
            })
          }
        >
          {sign ? <span className="price-sign">{sign}</span> : null}
          <span className="editable-number">{value}</span>
          <span className="price-edit-suffix">грн</span>
        </button>
      ) : (
        <div className="price-edit-wrapper" style={{ fontSize: 14 }}>
          {sign ? <span className="price-sign">{sign}</span> : null}
          <PriceLineInput value={value} onChange={onChange} />
          <span className="price-edit-suffix">грн</span>
        </div>
      )}
    </div>
  );
}

function PayMethods({
  type,
  active,
  onSelect,
}: {
  type: "prepay" | "surcharge";
  active: string;
  onSelect: (m: string) => void;
}) {
  const methods = ["ФОП", "Картка", "Готівка"];
  return (
    <div className="pay-methods" id={type === "prepay" ? "prepayMethods" : "surchargeMethods"}>
      {methods.map((m) => (
        <button
          key={m}
          type="button"
          className={`pay-chip${m === active ? " active" : ""}`}
          data-method={m}
          onClick={() => onSelect(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
