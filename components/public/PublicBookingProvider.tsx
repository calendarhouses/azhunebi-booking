"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { nightWord } from "@/components/admin/desktop/adminPlural";
import {
  computeBookingPrice,
  getBookingMinNightsRequired,
  getRestrictionMinNights,
  isDateClosed,
} from "@/components/admin/desktop/bookingPriceEngine";
import type {
  AdminSettingsPayload,
  BookingRecord,
  CustomServiceConfig,
  RoomConfig,
} from "@/components/admin/desktop/types";
import {
  calculatePrepaymentAmount,
  formatPrepaymentGuestLabel,
  readPrepaymentPolicy,
} from "@/lib/public-booking/prepaymentPolicy";
import {
  formatDateKey,
  getBookedRanges,
  getNextFreeDateLabel,
} from "@/lib/public-booking/bookedRanges";
import {
  createMonoPayment,
  ensurePaymentLinkSms,
  fetchPublicInitData,
  submitPublicBooking,
  type SubmitBookingPayload,
} from "@/lib/public-booking/publicApiClient";
import { showPublicToast, stripHtmlTags } from "@/lib/public-booking/publicToast";
import { formatUaPhoneE164, normalizeUaNationalPhoneDigits } from "@/lib/public-booking/uaPhone";
import {
  buildChildrenCommentToken,
  buildServiceCommentTokens,
  listServicesForRoom,
  roomAllowsChildren,
  type ServiceSelectionMap,
} from "@/components/admin/desktop/settings/additionalServicesLogic";
import {
  buildEarlyCommentToken,
  buildLateCommentToken,
  resolveFlexibleScheduleSettings,
} from "@/lib/admin/flexibleSchedule";
import {
  buildPromoCodeCommentToken,
  discountConfigToApplied,
  formatAppliedDiscountLabel,
  hasActivePromoCodeDiscounts,
  promoCodeAppliesToBooking,
} from "@/lib/admin/bookingDiscountCalc";
import {
  getDiscountKind,
  getSpecialTariffToggleLabel,
  resolveDiscountActive,
} from "@/components/admin/desktop/settings/discountConfig";
import { getRoomImages } from "@/lib/public-booking/roomHelpers";
import { buildPublicReceiptHtml, buildPublicPendingReceiptHtml } from "@/lib/public-booking/publicReceipt";
import {
  BOOKING_STATUS_PENDING_REVIEW,
  needsManualReview,
  type PublicBookingFlow,
} from "@/lib/public-booking/bookingReview";
import type {
  PublicPriceBreakdown,
  PublicRoom,
  PublicSiteRuntime,
  PublicTenantPayload,
} from "@/lib/public-booking/types";

const PRELOADER_MIN_MS = 1200;

type DrawerStep = "info" | "calendar" | "checkout";

type Ctx = {
  runtime: PublicSiteRuntime | null;
  initLoading: boolean;
  preloaderVisible: boolean;
  activeScreen: "list" | "success";
  setActiveScreen: (s: "list" | "success") => void;
  drawerOpen: boolean;
  drawerStep: DrawerStep;
  drawerScrollKey: number;
  selectedRoom: RoomConfig | null;
  openDrawer: (room: RoomConfig) => void;
  closeDrawer: () => void;
  goDrawerStep: (step: DrawerStep) => void;
  detailSlide: number;
  setDetailSlide: (n: number) => void;
  slideDetail: (dir: number) => void;
  calBase: Date;
  shiftCal: (dir: number) => void;
  checkIn: Date | null;
  checkOut: Date | null;
  selectDate: (ds: string) => void;
  guestCount: number;
  changeGuests: (delta: number) => void;
  childCount: number;
  changeChildren: (delta: number) => void;
  availableServices: CustomServiceConfig[];
  selectedServices: ServiceSelectionMap;
  setServiceQty: (serviceId: number, qty: number) => void;
  showChildren: boolean;
  flexibleSchedule: ReturnType<typeof resolveFlexibleScheduleSettings>;
  hasUbd: boolean;
  setHasUbd: (v: boolean) => void;
  earlyTime: string | null;
  lateTime: string | null;
  toggleService: (kind: "early" | "late") => void;
  selectTime: (kind: "early" | "late", time: string) => void;
  earlyActive: boolean;
  lateActive: boolean;
  showUbd: boolean;
  ubdTariffLabel: string;
  ubdTariffHint: string;
  showPromoCode: boolean;
  promoCode: string;
  setPromoCode: (code: string) => void;
  promoCodeStatus: "idle" | "valid" | "invalid";
  proceedDisabled: boolean;
  proceedLabel: string;
  price: PublicPriceBreakdown | null;
  priceError: string | null;
  refreshCalendar: () => void;
  calKey: number;
  submitCheckout: (form: {
    firstName: string;
    lastName: string;
    phone: string;
    comment: string;
  }) => Promise<void>;
  submitting: boolean;
  getRoomById: (id: number) => RoomConfig | undefined;
  getNextFreeForRoom: (room: RoomConfig) => string;
  successReceiptHtml: string;
  successFlow: PublicBookingFlow;
};

const PublicBookingContext = createContext<Ctx | null>(null);

export function usePublicBooking() {
  const ctx = useContext(PublicBookingContext);
  if (!ctx) throw new Error("usePublicBooking outside provider");
  return ctx;
}

function emptyPrice(): PublicPriceBreakdown {
  return {
    basePrice: 0,
    extraGuestFee: 0,
    petFee: 0,
    dayGuestFee: 0,
    earlyFee: 0,
    lateFee: 0,
    discountAmount: 0,
    discountPercent: 0,
    discountLines: [],
    totalPrice: 0,
    prepayment: 0,
    prepaymentLabel: "50%",
    nights: 0,
    serviceLines: [],
  };
}

export function PublicBookingProvider({
  data,
  children,
}: {
  data: PublicTenantPayload;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const [runtime, setRuntime] = useState<PublicSiteRuntime | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [preloaderDone, setPreloaderDone] = useState(false);
  const [activeScreen, setActiveScreen] = useState<"list" | "success">("list");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerStep, setDrawerStep] = useState<DrawerStep>("info");
  const [drawerScrollKey, setDrawerScrollKey] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<RoomConfig | null>(null);
  const [detailSlide, setDetailSlide] = useState(0);
  const [calBase, setCalBase] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [calKey, setCalKey] = useState(0);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [childCount, setChildCount] = useState(0);
  const [selectedServices, setSelectedServices] = useState<ServiceSelectionMap>({});
  const [hasUbd, setHasUbd] = useState(false);
  const [earlyTime, setEarlyTime] = useState<string | null>(null);
  const [lateTime, setLateTime] = useState<string | null>(null);
  const [earlyActive, setEarlyActive] = useState(false);
  const [lateActive, setLateActive] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successReceiptHtml, setSuccessReceiptHtml] = useState("");
  const [successFlow, setSuccessFlow] = useState<PublicBookingFlow>("instant");

  useEffect(() => {
    const t = window.setTimeout(() => setPreloaderDone(true), PRELOADER_MIN_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const init = await fetchPublicInitData(data.tenantId);
        if (cancelled) return;
        const settings = init.settings || {};
        const roomsFromApi = (settings.roomsList || data.rooms) as RoomConfig[];
        setRuntime({
          ...data,
          rooms: roomsFromApi.filter((r) => r.active !== false),
          discounts: (settings.discountsList as typeof data.discounts) || data.discounts,
          customPrices: settings.customPrices || data.customPrices,
          bookings: init.bookings || [],
          restrictions: settings.restrictions || {},
          closedDates: settings.closedDates || {},
          sysServicesList: settings.sysServicesList || [],
          customServicesList: settings.customServicesList || [],
          flexibleScheduleSettings: settings.flexibleScheduleSettings,
        });
      } catch (e) {
        console.error(e);
        setRuntime({
          ...data,
          bookings: [],
          restrictions: {},
          closedDates: {},
          sysServicesList: [],
          customServicesList: [],
        });
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  useEffect(() => {
    const paymentReturn = searchParams.get("payment") === "return";
    const returnedOrderId = searchParams.get("orderId")?.trim() || "";
    const submittedPending = searchParams.get("submitted") === "pending";

    if (paymentReturn && returnedOrderId) {
      let cancelled = false;
      let attempt = 0;

      const confirmPayment = async () => {
        attempt += 1;
        try {
          const response = await fetch(
            `/api/payments/monopay/status?orderId=${encodeURIComponent(returnedOrderId)}`,
            { cache: "no-store" }
          );
          const result = (await response.json()) as {
            paid?: boolean;
            awaiting?: boolean;
            booking?: import("@/lib/public-booking/publicReceipt").PublicBookingReceiptData;
          };
          if (cancelled) return;

          if (response.ok && result.paid) {
            let storedBooking: import("@/lib/public-booking/publicReceipt").PublicBookingReceiptData | null =
              null;
            try {
              const raw = sessionStorage.getItem("lastBooking");
              storedBooking = raw
                ? (JSON.parse(
                    raw
                  ) as import("@/lib/public-booking/publicReceipt").PublicBookingReceiptData)
                : null;
            } catch {
              storedBooking = null;
            }
            const booking =
              storedBooking?.orderId === returnedOrderId
                ? storedBooking
                : result.booking;
            if (!booking) return;

            booking.flow = "instant";
            setSuccessFlow("instant");
            setSuccessReceiptHtml(buildPublicReceiptHtml(booking));
            setActiveScreen("success");
            // Clean the address only after the payment check has completed.
            window.setTimeout(() => window.history.replaceState(null, "", "/"), 0);
            return;
          }

          if (response.ok && result.awaiting === false) {
            showPublicToast("Оплату не підтверджено. Спробуйте ще раз.");
            return;
          }
        } catch {
          // Webhook may still be in transit; retry below.
        }

        if (!cancelled && attempt < 15) {
          window.setTimeout(confirmPayment, 1_500);
        } else if (!cancelled) {
          showPublicToast("Оплата ще обробляється. Перевірте бронювання за кілька хвилин.");
        }
      };

      void confirmPayment();
      return () => {
        cancelled = true;
      };
    }

    if (!submittedPending) return;

    setActiveScreen("success");
    const raw = sessionStorage.getItem("lastBooking");
    if (raw) {
      try {
        const b = JSON.parse(raw) as import("@/lib/public-booking/publicReceipt").PublicBookingReceiptData;
        const flow = b.flow || "pending_review";
        setSuccessFlow(flow);
        setSuccessReceiptHtml(
          flow === "pending_review" ? buildPublicPendingReceiptHtml(b) : buildPublicReceiptHtml(b)
        );
      } catch {
        /* ignore */
      }
    }
  }, [searchParams]);

  const preloaderVisible = !preloaderDone || initLoading;

  useEffect(() => {
    if (!preloaderVisible) {
      document.body.classList.add("ready");
      if (!drawerOpen) {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
      return;
    }
    document.body.classList.remove("ready");
  }, [preloaderVisible, drawerOpen]);

  // Re-assert ready after paint — PublicBookPage body-class effect must not leave CTAs dead.
  useEffect(() => {
    if (preloaderVisible) return;
    const id = window.requestAnimationFrame(() => {
      document.body.classList.add("ready");
    });
    return () => window.cancelAnimationFrame(id);
  }, [preloaderVisible]);

  const settings = useMemo((): AdminSettingsPayload | null => {
    if (!runtime) return null;
    return {
      roomsList: runtime.rooms,
      discountsList: runtime.discounts.map((d) => ({
        ...d,
        rooms: d.rooms || "Всі",
      })),
      customPrices: runtime.customPrices,
      restrictions: runtime.restrictions,
      closedDates: runtime.closedDates,
      sysServicesList: runtime.sysServicesList,
      customServicesList: runtime.customServicesList,
      flexibleScheduleSettings: runtime.flexibleScheduleSettings,
    };
  }, [runtime]);

  const getRoomById = useCallback(
    (id: number) => runtime?.rooms.find((r) => r.id === id),
    [runtime]
  );

  const getNextFreeForRoom = useCallback(
    (room: RoomConfig) => {
      if (!runtime) return "перевірте дати";
      return getNextFreeDateLabel(runtime.bookings, room);
    },
    [runtime]
  );

  const resetBookingForm = useCallback(() => {
    setCheckIn(null);
    setCheckOut(null);
    setGuestCount(2);
    setChildCount(0);
    setSelectedServices({});
    setHasUbd(false);
    setEarlyTime(null);
    setLateTime(null);
    setEarlyActive(false);
    setLateActive(false);
    setPromoCode("");
    const d = new Date();
    d.setDate(1);
    setCalBase(d);
  }, []);

  const openDrawer = useCallback(
    (room: RoomConfig) => {
      setSelectedRoom(room);
      setDrawerStep("info");
      setDetailSlide(0);
      resetBookingForm();
      setDrawerScrollKey((key) => key + 1);
      setDrawerOpen(true);
      document.body.style.overflow = "hidden";
    },
    [resetBookingForm]
  );

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    document.body.style.overflow = document.body.classList.contains("ready") ? "" : "hidden";
    document.documentElement.style.overflow = document.body.classList.contains("ready")
      ? ""
      : "hidden";
  }, []);

  const goDrawerStep = useCallback((step: DrawerStep) => {
    setDrawerStep(step);
    setDrawerScrollKey((key) => key + 1);
    if (step === "calendar") setCalKey((k) => k + 1);
  }, []);

  const slideDetail = useCallback(
    (dir: number) => {
      if (!selectedRoom) return;
      const images = getRoomImages(selectedRoom as PublicRoom);
      setDetailSlide((prev) => (prev + dir + images.length) % images.length);
    },
    [selectedRoom]
  );

  const shiftCal = useCallback((dir: number) => {
    setCalBase((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + dir);
      return d;
    });
  }, []);

  const selectDate = useCallback(
    (ds: string) => {
      if (!selectedRoom || !runtime) return;
      const d = new Date(ds);
      d.setHours(0, 0, 0, 0);
      const ranges = getBookedRanges(runtime.bookings, selectedRoom);

      let blocked = false;
      for (const r of ranges) {
        if (d > r.start && d < r.end) blocked = true;
        if (d.getTime() === r.end.getTime() && r.hasLate) blocked = true;
        if (d.getTime() === r.start.getTime()) {
          if (r.hasEarly) blocked = true;
          else if (!checkIn || (checkIn && checkOut)) blocked = true;
          else if (checkIn && !checkOut && d <= checkIn) blocked = true;
        }
      }
      if (blocked) {
        setCheckIn(null);
        setCheckOut(null);
        setCalKey((k) => k + 1);
        return;
      }

      if (isDateClosed(runtime.closedDates, selectedRoom.id, d, runtime.restrictions)) {
        showPublicToast("Ця дата закрита для бронювання");
        setCheckIn(null);
        setCheckOut(null);
        setCalKey((k) => k + 1);
        return;
      }

      if (!checkIn || (checkIn && checkOut) || d <= checkIn) {
        setCheckIn(d);
        setCheckOut(null);
      } else {
        let conflict = false;
        let closedConflict = false;
        const cur = new Date(checkIn);
        cur.setDate(cur.getDate() + 1);
        while (cur < d) {
          if (isDateClosed(runtime.closedDates, selectedRoom.id, cur, runtime.restrictions)) {
            conflict = true;
            closedConflict = true;
            break;
          }
          if (
            ranges.some(
              (r) =>
                (cur > r.start && cur < r.end) ||
                (cur.getTime() === r.start.getTime() && r.hasEarly)
            )
          ) {
            conflict = true;
            break;
          }
          cur.setDate(cur.getDate() + 1);
        }
        if (conflict) {
          showPublicToast(
            closedConflict
              ? "У періоді є закриті дати"
              : "Цей період перетинається з іншою бронню"
          );
          setCheckIn(d);
          setCheckOut(null);
        } else {
          const nights = Math.round((d.getTime() - checkIn.getTime()) / 86400000);
          const req = getBookingMinNightsRequired(
            selectedRoom,
            checkIn,
            d,
            runtime.restrictions || {}
          );
          if (req > 0 && nights < req) {
            showPublicToast(`Для обраних дат мінімум ${req} ${nightWord(req)}`);
            setCheckOut(null);
          } else {
            setCheckOut(d);
          }
        }
      }
      setCalKey((k) => k + 1);
    },
    [checkIn, checkOut, runtime, selectedRoom]
  );

  const changeGuests = useCallback(
    (delta: number) => {
      if (!selectedRoom) return;
      const max = selectedRoom.maxCapacity || selectedRoom.capacity;
      setGuestCount((g) => {
        const next = g + delta;
        if (next < 1) return g;
        if (next + childCount > max) {
          if (delta > 0) {
            showPublicToast(`Максимум для цього котеджу: ${max} гостей (дорослі + діти)`);
          }
          return g;
        }
        return next;
      });
    },
    [selectedRoom, childCount]
  );

  const changeChildren = useCallback(
    (delta: number) => {
      if (!selectedRoom) return;
      const max = selectedRoom.maxCapacity || selectedRoom.capacity;
      setChildCount((c) => {
        const next = c + delta;
        if (next < 0) return c;
        if (guestCount + next > max) {
          if (delta > 0) {
            showPublicToast(`Максимум для цього котеджу: ${max} гостей (дорослі + діти)`);
          }
          return c;
        }
        return next;
      });
    },
    [selectedRoom, guestCount]
  );

  const setServiceQty = useCallback((serviceId: number, qty: number) => {
    setSelectedServices((prev) => ({ ...prev, [String(serviceId)]: Math.max(0, qty) }));
  }, []);

  const availableServices = useMemo(
    () => listServicesForRoom(runtime?.customServicesList, selectedRoom),
    [runtime?.customServicesList, selectedRoom]
  );

  const showChildren = useMemo(() => roomAllowsChildren(selectedRoom), [selectedRoom]);

  const flexibleSchedule = useMemo(
    () => resolveFlexibleScheduleSettings(settings ?? undefined),
    [settings]
  );

  const nights =
    checkIn && checkOut
      ? Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)
      : 0;

  const ubdDiscount = useMemo(() => {
    return (
      (settings?.discountsList || []).find(
        (d) => getDiscountKind(d) === "ubd" && resolveDiscountActive(d)
      ) ?? null
    );
  }, [settings?.discountsList]);

  const ubdDiscountId = ubdDiscount ? String(ubdDiscount.id) : null;
  const ubdTariffLabel = ubdDiscount ? getSpecialTariffToggleLabel(ubdDiscount) : "";
  const ubdTariffHint = ubdDiscount
    ? `−${formatAppliedDiscountLabel(discountConfigToApplied(ubdDiscount))} (потрібне підтвердження)`
    : "";

  const showUbd = nights === 1 && !!ubdDiscountId;

  useEffect(() => {
    if (!showUbd) setHasUbd(false);
  }, [showUbd]);

  const enabledSpecialTariffIds = useMemo(() => {
    if (hasUbd && ubdDiscountId && nights === 1) return [ubdDiscountId];
    return [];
  }, [hasUbd, nights, ubdDiscountId]);

  const showPromoCode = useMemo(
    () =>
      hasActivePromoCodeDiscounts(
        settings?.discountsList,
        selectedRoom ? String(selectedRoom.id) : undefined
      ),
    [settings?.discountsList, selectedRoom]
  );

  const promoCodeStatus = useMemo((): "idle" | "valid" | "invalid" => {
    if (!showPromoCode || !promoCode.trim() || !selectedRoom || !checkIn || !checkOut) {
      return "idle";
    }
    return promoCodeAppliesToBooking(promoCode, settings?.discountsList || [], {
      checkIn: formatDateKey(checkIn),
      checkOut: formatDateKey(checkOut),
      nights,
      roomId: String(selectedRoom.id),
      enabledSpecialTariffIds: [],
    })
      ? "valid"
      : "invalid";
  }, [
    showPromoCode,
    promoCode,
    selectedRoom,
    checkIn,
    checkOut,
    nights,
    settings?.discountsList,
  ]);

  const priceResult = useMemo(() => {
    if (!selectedRoom || !settings || !checkIn || !checkOut || !runtime) {
      return { price: null as PublicPriceBreakdown | null, error: null as string | null };
    }
    const calc = computeBookingPrice({
      checkInStr: formatDateKey(checkIn),
      checkOutStr: formatDateKey(checkOut),
      roomName: selectedRoom.name,
      guests: guestCount,
      children: childCount,
      pets: "Ні",
      dayGuests: 0,
      isVat: false,
      selectedServices,
      isPublicBooking: true,
      promoCode,
      enabledSpecialTariffIds,
      selectedEarlyTime: earlyTime,
      selectedLateTime: lateTime,
      room: selectedRoom,
      settings,
      allBookings: runtime.bookings,
      editingRow: null,
      isInitialLoad: false,
      manual: {
        base: null,
        extra: null,
        pet: null,
        dayGuest: null,
        early: null,
        late: null,
        discount: null,
        discountEdited: false,
      },
      prevForm: null,
    });
    if (calc.isOverlap) {
      return { price: null, error: calc.overlapReason || "Дати зайняті" };
    }
    if (calc.restrViolation) {
      return {
        price: null,
        error: `Мінімум ${calc.requiredMinNights} ${nightWord(calc.requiredMinNights)}`,
      };
    }
    const prepaymentPolicy = readPrepaymentPolicy(data.branding);
    const prepayment = calculatePrepaymentAmount(prepaymentPolicy, {
      totalPrice: calc.totalPrice,
      basePriceTotal: calc.basePriceTotal,
      nights: calc.nights,
    });
    return {
      price: {
        basePrice: calc.basePriceTotal,
        extraGuestFee: calc.extraGuestFee,
        petFee: calc.petFee,
        dayGuestFee: calc.dayGuestFee,
        earlyFee: calc.earlyFee,
        lateFee: calc.lateFee,
        discountAmount: calc.discountAmount,
        discountPercent: calc.discountPercent,
        discountLines: calc.discountLines,
        totalPrice: calc.totalPrice,
        prepayment,
        prepaymentLabel: formatPrepaymentGuestLabel(prepaymentPolicy),
        nights: calc.nights,
        serviceLines: calc.serviceLines.filter((line) => line.quantity > 0),
      },
      error: null,
    };
  }, [
    selectedRoom,
    settings,
    checkIn,
    checkOut,
    runtime,
    guestCount,
    childCount,
    selectedServices,
    hasUbd,
    nights,
    promoCode,
    enabledSpecialTariffIds,
    ubdDiscountId,
    earlyTime,
    lateTime,
    data.branding,
  ]);

  const proceedDisabled = !checkIn || !checkOut || Boolean(priceResult.error);
  let proceedLabel = "Оберіть дати";
  if (checkIn && !checkOut) {
    const min = selectedRoom
      ? getRestrictionMinNights(runtime?.restrictions || {}, selectedRoom.id, checkIn)
      : 0;
    proceedLabel = min > 1 ? `Мінімум ${min} ${nightWord(min)}` : "Оберіть дату виїзду";
  } else if (checkIn && checkOut && priceResult.error) {
    // Keep CTA short — full message is shown in BookingFlexConflictAlert (HTML stripped here).
    const plain = stripHtmlTags(priceResult.error);
    proceedLabel =
      plain.length > 42 || /ранн|пізн/i.test(plain)
        ? "Оберіть інші умови"
        : plain || "Дати зайняті";
  } else if (checkIn && checkOut) {
    proceedLabel = "Перейти до оформлення";
  }

  const toggleService = useCallback((kind: "early" | "late") => {
    if (kind === "early") {
      setEarlyActive((a) => {
        if (a) setEarlyTime(null);
        return !a;
      });
    } else {
      setLateActive((a) => {
        if (a) setLateTime(null);
        return !a;
      });
    }
  }, []);

  const selectTime = useCallback((kind: "early" | "late", time: string) => {
    if (kind === "early") setEarlyTime(time);
    else setLateTime(time);
  }, []);

  const submitCheckout = useCallback(
    async (form: { firstName: string; lastName: string; phone: string; comment: string }) => {
      if (!selectedRoom || !runtime || !checkIn || !checkOut || !priceResult.price) return;
      const { firstName, lastName, phone, comment } = form;
      if (!firstName.trim()) {
        showPublicToast("Введіть ваше ім'я");
        return;
      }
      if (!phone.trim() || normalizeUaNationalPhoneDigits(phone).length < 9) {
        showPublicToast("Введіть коректний номер телефону");
        return;
      }

      const calc = priceResult.price;
      let fullComment = comment.trim();
      const servicesById = new Map(
        (runtime?.customServicesList || []).map((s) => [s.id, s] as const)
      );
      const parts: string[] = [];
      const childrenToken = buildChildrenCommentToken(childCount);
      if (childrenToken) parts.push(childrenToken);
      parts.push(
        ...buildServiceCommentTokens(selectedServices, servicesById, { isPublicBooking: true })
      );
      if (earlyTime) {
        parts.push(
          buildEarlyCommentToken(earlyTime, flexibleSchedule.requiresApproval)
        );
      }
      if (lateTime) {
        parts.push(buildLateCommentToken(lateTime, flexibleSchedule.requiresApproval));
      }
      if (hasUbd && nights === 1) parts.push("🇺🇦 УБД: Так");
      const promoToken = buildPromoCodeCommentToken(promoCode);
      if (promoToken) parts.push(promoToken);
      if (parts.length) {
        fullComment = parts.join(" | ") + (fullComment ? `\n\nКоментар гостя: ${fullComment}` : "");
      }

      const manualReview = needsManualReview({
        nights: calc.nights,
        earlyTime,
        lateTime,
        flexibleRequiresApproval: flexibleSchedule.requiresApproval,
        selectedServices,
        servicesById: new Map(
          (runtime?.customServicesList || []).map((s) => [String(s.id), s] as const)
        ),
        hasUbd,
      });

      const payload: SubmitBookingPayload = {
        tenant_id: data.tenantId,
        checkIn: formatDateKey(checkIn),
        checkOut: formatDateKey(checkOut),
        cottage: selectedRoom.name,
        roomId: selectedRoom.id,
        name: `${firstName} ${lastName}`.trim(),
        phone: formatUaPhoneE164(phone),
        guests: guestCount,
        pets: "Ні",
        source: "Сайт",
        status: manualReview ? BOOKING_STATUS_PENDING_REVIEW : "Очікує оплату",
        totalPrice: calc.totalPrice,
        paidAmount: 0,
        prepayAmount: calc.prepayment,
        comment: fullComment,
        basePrice: calc.basePrice,
        extraGuestFee: calc.extraGuestFee,
        petFee: calc.petFee,
        dayGuestFee: calc.dayGuestFee,
        earlyFee: calc.earlyFee,
        lateFee: calc.lateFee,
      };

      setSubmitting(true);
      try {
        const json = await submitPublicBooking(payload);
        if (json.error === "OVERLAP") {
          showPublicToast("❌ Ці дати вже зайняті! Оберіть інші.");
          return;
        }
        if (json.error === "MIN_STAY" && json.requiredMin) {
          showPublicToast(
            `❌ Мінімальний термін — ${json.requiredMin} ${nightWord(json.requiredMin)}`
          );
          return;
        }
        if (json.error) {
          showPublicToast("❌ Не вдалося створити бронювання");
          return;
        }

        const flow: PublicBookingFlow =
          json.flow === "pending_review" || manualReview ? "pending_review" : "instant";
        const orderId = String(json.orderId || "").trim();
        if (!orderId) {
          showPublicToast("❌ Бронювання створено без номера. Зверніться до адміністратора.");
          return;
        }
        const paymentAmount = Math.round(Number(json.prepayment) || calc.prepayment || 0);

        const sessionData = {
          orderId,
          flow,
          cottage: payload.cottage,
          checkIn: payload.checkIn,
          checkOut: payload.checkOut,
          guests: guestCount,
          childCount,
          pets: "Ні",
          totalPrice: calc.totalPrice,
          prepayment: paymentAmount,
          earlyTime,
          lateTime,
          selectedServices,
          hasUbd,
          name: payload.name,
          phone: payload.phone,
          comment: fullComment,
          basePrice: calc.basePrice,
          extraGuestFee: calc.extraGuestFee,
          petFee: calc.petFee,
          dayGuestFee: calc.dayGuestFee,
          earlyFee: calc.earlyFee,
          lateFee: calc.lateFee,
          discountAmount: calc.discountAmount,
          discountPercent: calc.discountPercent,
          discountLines: calc.discountLines,
          prepaymentLabel: calc.prepaymentLabel,
          nights: calc.nights,
          serviceLines: calc.serviceLines,
          paidAmount: 0,
          status:
            flow === "pending_review"
              ? BOOKING_STATUS_PENDING_REVIEW
              : "Очікує оплату",
          source: "Сайт",
        };
        try {
          sessionStorage.setItem("lastBooking", JSON.stringify(sessionData));
        } catch (storageErr) {
          console.warn("[Booking] sessionStorage unavailable", storageErr);
        }

        if (flow === "pending_review") {
          setSuccessFlow("pending_review");
          setSuccessReceiptHtml(buildPublicPendingReceiptHtml(sessionData));
          closeDrawer();
          setActiveScreen("success");
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}?submitted=pending`
          );
          return;
        }

        if (paymentAmount > 0) {
          try {
            // Do not delay MonoPay while TurboSMS processes the message.
            void ensurePaymentLinkSms(orderId).catch((error) => {
              console.warn("[Booking] Payment link SMS will be retried", {
                orderId,
                error,
              });
            });
            const invoice = await createMonoPayment(orderId);
            sessionData.prepayment = invoice.amount;
            try {
              sessionStorage.setItem("lastBooking", JSON.stringify(sessionData));
            } catch (storageErr) {
              console.warn("[Booking] sessionStorage unavailable", storageErr);
            }
            const pageUrl = String(invoice.pageUrl || "").trim();
            if (/^https:\/\//i.test(pageUrl)) {
              window.location.assign(pageUrl);
              return;
            }
            showPublicToast(
              "Бронювання створено. Відкриваємо сторінку оплати…"
            );
            window.location.assign(`/pay/${encodeURIComponent(orderId)}`);
          } catch {
            showPublicToast(
              "Бронювання створено, але MonoPay не відкрився. Спробуйте оплатити ще раз."
            );
            window.location.assign(`/pay/${encodeURIComponent(orderId)}`);
          }
          return;
        }

        setSuccessFlow("instant");
        setSuccessReceiptHtml(buildPublicReceiptHtml(sessionData));
        closeDrawer();
        setActiveScreen("success");
      } catch {
        showPublicToast("Помилка відправки. Спробуйте ще раз.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      selectedRoom,
      runtime,
      checkIn,
      checkOut,
      priceResult.price,
      childCount,
      selectedServices,
      flexibleSchedule,
      hasUbd,
      promoCode,
      earlyTime,
      lateTime,
      guestCount,
      data.tenantId,
      closeDrawer,
    ]
  );

  const value: Ctx = {
    runtime,
    initLoading,
    preloaderVisible,
    activeScreen,
    setActiveScreen,
    drawerOpen,
    drawerStep,
    drawerScrollKey,
    selectedRoom,
    openDrawer,
    closeDrawer,
    goDrawerStep,
    detailSlide,
    setDetailSlide,
    slideDetail,
    calBase,
    shiftCal,
    checkIn,
    checkOut,
    selectDate,
    guestCount,
    changeGuests,
    childCount,
    changeChildren,
    availableServices,
    selectedServices,
    setServiceQty,
    showChildren,
    flexibleSchedule,
    hasUbd,
    setHasUbd,
    earlyTime,
    lateTime,
    toggleService,
    selectTime,
    earlyActive,
    lateActive,
    showUbd,
    ubdTariffLabel,
    ubdTariffHint,
    showPromoCode,
    promoCode,
    setPromoCode,
    promoCodeStatus,
    proceedDisabled,
    proceedLabel,
    price: priceResult.price,
    priceError: priceResult.error,
    refreshCalendar: () => setCalKey((k) => k + 1),
    calKey,
    submitCheckout,
    submitting,
    getRoomById,
    getNextFreeForRoom,
    successReceiptHtml,
    successFlow,
  };

  return (
    <PublicBookingContext.Provider value={value}>{children}</PublicBookingContext.Provider>
  );
}

