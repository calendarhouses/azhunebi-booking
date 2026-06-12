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
} from "@/components/admin/desktop/bookingPriceEngine";
import type {
  AdminSettingsPayload,
  BookingRecord,
  RoomConfig,
} from "@/components/admin/desktop/types";
import {
  formatDateKey,
  getBookedRanges,
  getNextFreeDateLabel,
} from "@/lib/public-booking/bookedRanges";
import {
  fetchPublicInitData,
  redirectToWayForPay,
  submitPublicBooking,
  type SubmitBookingPayload,
} from "@/lib/public-booking/publicApiClient";
import { showPublicToast } from "@/lib/public-booking/publicToast";
import { getRoomImages } from "@/lib/public-booking/roomHelpers";
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
  dayGuests: number;
  changeDayGuests: (delta: number) => void;
  hasPets: boolean;
  setHasPets: (v: boolean) => void;
  hasVat: boolean;
  setHasVat: (v: boolean) => void;
  hasUbd: boolean;
  setHasUbd: (v: boolean) => void;
  earlyTime: string | null;
  lateTime: string | null;
  toggleService: (kind: "early" | "late") => void;
  selectTime: (kind: "early" | "late", time: string) => void;
  earlyActive: boolean;
  lateActive: boolean;
  showVat: boolean;
  showUbd: boolean;
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
    totalPrice: 0,
    prepayment: 0,
    nights: 0,
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
  const [dayGuests, setDayGuests] = useState(0);
  const [hasPets, setHasPets] = useState(false);
  const [hasVat, setHasVat] = useState(false);
  const [hasUbd, setHasUbd] = useState(false);
  const [earlyTime, setEarlyTime] = useState<string | null>(null);
  const [lateTime, setLateTime] = useState<string | null>(null);
  const [earlyActive, setEarlyActive] = useState(false);
  const [lateActive, setLateActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successReceiptHtml, setSuccessReceiptHtml] = useState("");

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
          sysServicesList: settings.sysServicesList || [],
          customServicesList: settings.customServicesList || [],
        });
      } catch (e) {
        console.error(e);
        setRuntime({
          ...data,
          bookings: [],
          restrictions: {},
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
    if (searchParams.get("payment") === "success") {
      setActiveScreen("success");
      const raw = sessionStorage.getItem("lastBooking");
      if (raw) {
        try {
          const b = JSON.parse(raw) as Record<string, unknown>;
          setSuccessReceiptHtml(buildReceiptHtml(b));
        } catch {
          /* ignore */
        }
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
    } else {
      document.body.classList.remove("ready");
    }
  }, [preloaderVisible, drawerOpen]);

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
      sysServicesList: runtime.sysServicesList,
      customServicesList: runtime.customServicesList,
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
    setDayGuests(0);
    setHasPets(false);
    setHasVat(false);
    setHasUbd(false);
    setEarlyTime(null);
    setLateTime(null);
    setEarlyActive(false);
    setLateActive(false);
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

      if (!checkIn || (checkIn && checkOut) || d <= checkIn) {
        setCheckIn(d);
        setCheckOut(null);
      } else {
        let conflict = false;
        const cur = new Date(checkIn);
        cur.setDate(cur.getDate() + 1);
        while (cur < d) {
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
          showPublicToast("Цей період перетинається з іншою бронню");
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
      setGuestCount((g) => Math.min(max, Math.max(1, g + delta)));
    },
    [selectedRoom]
  );

  const changeDayGuests = useCallback((delta: number) => {
    setDayGuests((g) => Math.max(0, g + delta));
  }, []);

  const showVat = selectedRoom ? selectedRoom.id !== 1 && selectedRoom.id !== 2 : false;
  const nights =
    checkIn && checkOut
      ? Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000)
      : 0;
  const showUbd = nights === 1;

  const priceResult = useMemo(() => {
    if (!selectedRoom || !settings || !checkIn || !checkOut || !runtime) {
      return { price: null as PublicPriceBreakdown | null, error: null as string | null };
    }
    const calc = computeBookingPrice({
      checkInStr: formatDateKey(checkIn),
      checkOutStr: formatDateKey(checkOut),
      roomName: selectedRoom.name,
      guests: guestCount,
      pets: hasPets ? "Так" : "Ні",
      dayGuests,
      isVat: hasVat,
      isUbd: hasUbd && nights === 1,
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
    const prepayment = Math.round(calc.totalPrice / 2);
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
        totalPrice: calc.totalPrice,
        prepayment,
        nights: calc.nights,
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
    hasPets,
    dayGuests,
    hasVat,
    hasUbd,
    nights,
    earlyTime,
    lateTime,
  ]);

  const proceedDisabled = !checkIn || !checkOut || Boolean(priceResult.error);
  let proceedLabel = "Оберіть дати";
  if (checkIn && !checkOut) {
    const min = selectedRoom
      ? getRestrictionMinNights(runtime?.restrictions || {}, selectedRoom.id, checkIn)
      : 0;
    proceedLabel = min > 1 ? `Мінімум ${min} ${nightWord(min)}` : "Оберіть дату виїзду";
  } else if (checkIn && checkOut && priceResult.error) {
    proceedLabel = priceResult.error;
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
      if (!phone.trim() || phone.replace(/\D/g, "").length < 9) {
        showPublicToast("Введіть коректний номер телефону");
        return;
      }

      const calc = priceResult.price;
      let fullComment = comment.trim();
      const parts: string[] = [];
      if (dayGuests > 0) parts.push(`👥 Денні гості: ${dayGuests}`);
      if (hasVat) parts.push("♨️ Чан: Так");
      if (hasUbd && nights === 1) parts.push("🇺🇦 УБД: Так");
      if (earlyTime) parts.push(`🕒 Ранній заїзд: з ${earlyTime}`);
      if (lateTime) parts.push(`🕒 Пізній виїзд: до ${lateTime}`);
      if (parts.length) {
        fullComment = parts.join(" | ") + (fullComment ? `\n\nКоментар гостя: ${fullComment}` : "");
      }

      const payload: SubmitBookingPayload = {
        tenant_id: data.tenantId,
        checkIn: formatDateKey(checkIn),
        checkOut: formatDateKey(checkOut),
        cottage: selectedRoom.name,
        roomId: selectedRoom.id,
        name: `${firstName} ${lastName}`.trim(),
        phone: "+380" + phone.replace(/\D/g, ""),
        guests: guestCount,
        pets: hasPets ? "Так" : "Ні",
        source: "Сайт",
        status: "Очікує оплату",
        totalPrice: calc.totalPrice,
        paidAmount: 0,
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

        const sessionData = {
          orderId: json.paymentData?.orderReference || `B-${Date.now()}`,
          cottage: payload.cottage,
          checkIn: payload.checkIn,
          checkOut: payload.checkOut,
          guests: guestCount,
          pets: payload.pets,
          totalPrice: calc.totalPrice,
          prepayment: json.paymentData?.amount ?? calc.prepayment,
          earlyTime,
          lateTime,
          dayGuests,
          hasVat,
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
          paidAmount: json.paymentData?.amount ?? 0,
          status: "Підтверджено",
          source: "Сайт",
        };
        sessionStorage.setItem("lastBooking", JSON.stringify(sessionData));

        if (json.paymentData && json.paymentData.amount > 0) {
          redirectToWayForPay(
            json.paymentData,
            { firstName, lastName, phone: payload.phone },
            `${window.location.origin}${window.location.pathname}?payment=success`
          );
          return;
        }

        setSuccessReceiptHtml(buildReceiptHtml(sessionData));
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
      dayGuests,
      hasVat,
      hasUbd,
      nights,
      earlyTime,
      lateTime,
      guestCount,
      hasPets,
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
    dayGuests,
    changeDayGuests,
    hasPets,
    setHasPets,
    hasVat,
    setHasVat,
    hasUbd,
    setHasUbd,
    earlyTime,
    lateTime,
    toggleService,
    selectTime,
    earlyActive,
    lateActive,
    showVat,
    showUbd,
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
  };

  return (
    <PublicBookingContext.Provider value={value}>{children}</PublicBookingContext.Provider>
  );
}

function buildReceiptHtml(b: Record<string, unknown>): string {
  const inD = new Date(String(b.checkIn)).toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
  });
  const outD = new Date(String(b.checkOut)).toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "long",
  });
  const prepay = Number(b.prepayment) || Number(b.paidAmount) || 0;
  const total = Number(b.totalPrice) || 0;
  return `
    <div class="receipt-header">
      <div class="receipt-title">Підтвердження бронювання</div>
      <div class="receipt-room">${b.cottage}</div>
    </div>
    <div class="receipt-row"><span class="receipt-label">Заїзд</span><span class="receipt-val">${inD}</span></div>
    <div class="receipt-row"><span class="receipt-label">Виїзд</span><span class="receipt-val">${outD}</span></div>
    <div class="receipt-row"><span class="receipt-label">Гості</span><span class="receipt-val">${b.guests}</span></div>
    <div class="receipt-total"><span>До сплати</span><span>${total.toLocaleString("uk-UA")} грн</span></div>
    <div class="receipt-row"><span class="receipt-label">Передплата</span><span class="receipt-val">${prepay.toLocaleString("uk-UA")} грн</span></div>
  `;
}
