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
  filterRoomsForStay,
  formatDateKey,
  getBookedRanges,
  getNextFreeDateLabel,
  isListSearchDateAvailable,
  isRoomFreeForRange,
  isStayClearOfBookings,
} from "@/lib/public-booking/bookedRanges";
import {
  arrivalAfterLateCheckout,
  buildPostLateCommentToken,
  findPrevLateCheckoutRange,
} from "@/lib/public-booking/postLateGapStay";
import {
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
  childrenPolicyViolationMessage,
  DEFAULT_YOUNGEST_CHILD_AGE,
  listServicesForRoom,
  MAX_CHILD_AGE,
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
import { adminRoomCottageValue } from "@/lib/admin/roomDisplay";
import { buildPublicReceiptHtml, buildPublicPendingReceiptHtml } from "@/lib/public-booking/publicReceipt";
import {
  BOOKING_STATUS_PENDING_REVIEW,
  needsManualReview,
  type PublicBookingFlow,
} from "@/lib/public-booking/bookingReview";
import { isPublicOnlinePaymentEnabled } from "@/lib/public-booking/onlinePayment";
import type {
  PublicPriceBreakdown,
  PublicRoom,
  PublicSiteRuntime,
  PublicTenantPayload,
} from "@/lib/public-booking/types";

type DrawerStep = "info" | "calendar" | "checkout" | "rules";

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
  /** Вибір дат у списковому фільтрі (без прив’язки до кімнати). */
  selectStayDate: (ds: string) => void;
  clearStayDates: () => void;
  guestCount: number;
  changeGuests: (delta: number) => void;
  childCount: number;
  changeChildren: (delta: number) => void;
  youngestChildAge: number;
  changeYoungestChildAge: (delta: number) => void;
  setYoungestChildAge: (age: number) => void;
  filteredRooms: RoomConfig[];
  listFilterActive: boolean;
  listGuestMax: number;
  availableServices: CustomServiceConfig[];
  selectedServices: ServiceSelectionMap;
  setServiceQty: (serviceId: number, qty: number) => void;
  showChildren: boolean;
  childrenPolicyMessage: string | null;
  childrenPolicyBlocked: boolean;
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
  /** Warning when stay starts on previous guest's late-checkout day. */
  postLateGapNotice: string | null;
  postLateArrivalTime: string | null;
  isPostLateGapStay: boolean;
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
  const [youngestChildAge, setYoungestChildAgeState] = useState(DEFAULT_YOUNGEST_CHILD_AGE);
  const [selectedServices, setSelectedServices] = useState<ServiceSelectionMap>({});
  const [hasUbd, setHasUbd] = useState(false);
  const [earlyTime, setEarlyTime] = useState<string | null>(null);
  const [lateTime, setLateTime] = useState<string | null>(null);
  const [earlyActive, setEarlyActive] = useState(false);
  const [lateActive, setLateActive] = useState(false);
  const [postLateArrivalTime, setPostLateArrivalTime] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successReceiptHtml, setSuccessReceiptHtml] = useState("");
  const [successFlow, setSuccessFlow] = useState<PublicBookingFlow>("instant");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const attempts = 3;
      let lastErr: unknown;
      for (let i = 0; i < attempts; i += 1) {
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
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          console.error(`[publicInit] attempt ${i + 1}/${attempts}`, e);
          if (i < attempts - 1) {
            await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
          }
        }
      }
      if (lastErr && !cancelled) {
        setRuntime({
          ...data,
          bookings: [],
          restrictions: {},
          closedDates: {},
          sysServicesList: [],
          customServicesList: [],
        });
      }
      if (!cancelled) setInitLoading(false);
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

  const preloaderVisible = initLoading;

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

  const resetDrawerExtras = useCallback(() => {
    setSelectedServices({});
    setHasUbd(false);
    setEarlyTime(null);
    setLateTime(null);
    setEarlyActive(false);
    setLateActive(false);
    setPostLateArrivalTime(null);
    setPromoCode("");
  }, []);

  const clearStayDates = useCallback(() => {
    setCheckIn(null);
    setCheckOut(null);
    setPostLateArrivalTime(null);
    setCalKey((k) => k + 1);
  }, []);

  const openDrawer = useCallback(
    (room: RoomConfig) => {
      setSelectedRoom(room);
      setDrawerStep("info");
      setDetailSlide(0);
      resetDrawerExtras();
      const max = room.maxCapacity || room.capacity || 1;
      const adults = Math.min(Math.max(guestCount, 1), max);
      const kids = Math.min(childCount, Math.max(0, max - adults));
      setGuestCount(adults);
      setChildCount(kids);
      setDrawerScrollKey((key) => key + 1);
      setDrawerOpen(true);
      document.body.style.overflow = "hidden";

      // If search dates don't fit this cottage, keep check-in and ask for a new checkout
      if (checkIn && checkOut && runtime) {
        const ok = isRoomFreeForRange(
          room,
          checkIn,
          checkOut,
          runtime.bookings,
          runtime.closedDates,
          runtime.restrictions
        );
        if (!ok) {
          setCheckOut(null);
          setCalKey((k) => k + 1);
          showPublicToast("Для цього будинку оберіть іншу дату виїзду");
        }
      }

      const violation = childrenPolicyViolationMessage(room, kids, youngestChildAge);
      if (violation) {
        showPublicToast(violation);
      }
    },
    [
      resetDrawerExtras,
      guestCount,
      childCount,
      youngestChildAge,
      checkIn,
      checkOut,
      runtime,
    ]
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
      const pickingCheckout = Boolean(checkIn && !checkOut);
      const t = d.getTime();

      let blocked = false;
      for (const r of ranges) {
        const isOccupiedNight = t >= r.start.getTime() && t < r.end.getTime();
        const isNextCheckIn = t === r.start.getTime();

        if (isOccupiedNight) {
          // Same-day turnover: next guest's check-in can be OUR checkout only if reachable
          const validTurnoverCheckout =
            pickingCheckout &&
            checkIn &&
            isNextCheckIn &&
            !r.hasEarly &&
            d > checkIn &&
            isStayClearOfBookings(checkIn, d, ranges);
          if (!validTurnoverCheckout) {
            blocked = true;
            break;
          }
        }
      }
      if (blocked) {
        // Clicking a blocked day starts a fresh check-in only if the night is free
        const nightFree = !ranges.some((r) => t >= r.start.getTime() && t < r.end.getTime());
        if (nightFree && !isDateClosed(runtime.closedDates, selectedRoom.id, d, runtime.restrictions)) {
          setCheckIn(d);
          setCheckOut(null);
          setPostLateArrivalTime(null);
        } else {
          showPublicToast("Ця дата недоступна");
        }
        setCalKey((k) => k + 1);
        return;
      }

      if (isDateClosed(runtime.closedDates, selectedRoom.id, d, runtime.restrictions)) {
        // Closed nights can't be check-in; checkout on a closed calendar day is still OK
        // only when it is a turnover checkout (handled above as not closed nights).
        // Closed-only days (no booking) block both.
        showPublicToast("Ця дата закрита для бронювання");
        setCalKey((k) => k + 1);
        return;
      }

      // Tap selected check-in again (before checkout) → clear selection
      if (checkIn && !checkOut && t === checkIn.getTime()) {
        setCheckIn(null);
        setCheckOut(null);
        setPostLateArrivalTime(null);
        setCalKey((k) => k + 1);
        return;
      }

      // Keep existing range when tapping the already-selected endpoints
      if (checkIn && checkOut) {
        if (t === checkIn.getTime() || t === checkOut.getTime()) {
          return;
        }
      }

      if (!checkIn || (checkIn && checkOut) || d <= checkIn) {
        setCheckIn(d);
        setCheckOut(null);
        setPostLateArrivalTime(null);
      } else {
        // Prefer shared conflict helper (early/late edges + half-open nights)
        const stayBlocked = !isStayClearOfBookings(checkIn, d, ranges);
        let closedConflict = false;
        if (!stayBlocked) {
          const cur = new Date(checkIn);
          while (cur < d) {
            if (isDateClosed(runtime.closedDates, selectedRoom.id, cur, runtime.restrictions)) {
              closedConflict = true;
              break;
            }
            cur.setDate(cur.getDate() + 1);
          }
        }
        if (stayBlocked || closedConflict) {
          showPublicToast(
            closedConflict
              ? "У періоді є закриті дати"
              : "Цей період перетинається з іншою бронню"
          );
          setCheckIn(d);
          setCheckOut(null);
          setPostLateArrivalTime(null);
        } else {
          const nights = Math.round((d.getTime() - checkIn.getTime()) / 86400000);
          const req = getBookingMinNightsRequired(
            selectedRoom,
            checkIn,
            d,
            runtime.restrictions || {}
          );
          if (req > 0 && nights < req) {
            const gapPrev = findPrevLateCheckoutRange(checkIn, ranges);
            if (gapPrev) {
              const arrival = arrivalAfterLateCheckout(gapPrev.lateTime);
              setPostLateArrivalTime(arrival);
              setLateTime(null);
              setLateActive(false);
              setCheckOut(d);
              showPublicToast(
                `Заїзд з ${arrival} · −50% на ніч`
              );
            } else {
              showPublicToast(`Для обраних дат мінімум ${req} ${nightWord(req)}`);
              setCheckOut(null);
            }
          } else {
            const gapPrev = findPrevLateCheckoutRange(checkIn, ranges);
            if (gapPrev) {
              const arrival = arrivalAfterLateCheckout(gapPrev.lateTime);
              setPostLateArrivalTime(arrival);
              setLateTime(null);
              setLateActive(false);
              showPublicToast(
                `Заїзд з ${arrival} · −50% на ніч`
              );
            } else {
              setPostLateArrivalTime(null);
            }
            setCheckOut(d);
          }
        }
      }
      setCalKey((k) => k + 1);
    },
    [checkIn, checkOut, runtime, selectedRoom]
  );

  const selectStayDate = useCallback(
    (ds: string) => {
      const d = new Date(ds);
      d.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) return;
      if (!runtime?.rooms.length) return;

      const opts = {
        checkIn,
        checkOut,
        adults: guestCount,
        children: childCount,
        youngestAge: childCount > 0 ? youngestChildAge : null,
        bookings: runtime.bookings,
        closedDates: runtime.closedDates,
        restrictions: runtime.restrictions,
      };

      if (!isListSearchDateAvailable(d, runtime.rooms, opts)) {
        showPublicToast("На цю дату немає вільних будинків");
        return;
      }

      // Tap selected check-in again (before checkout) → clear selection
      if (checkIn && !checkOut && d.getTime() === checkIn.getTime()) {
        setCheckIn(null);
        setCheckOut(null);
        setPostLateArrivalTime(null);
        setCalKey((k) => k + 1);
        return;
      }

      if (!checkIn || (checkIn && checkOut) || d <= checkIn) {
        setCheckIn(d);
        setCheckOut(null);
        setPostLateArrivalTime(null);
      } else {
        // Room-specific gap notice is applied when a cottage is opened.
        setCheckOut(d);
      }
      setCalKey((k) => k + 1);
    },
    [checkIn, checkOut, runtime, guestCount, childCount, youngestChildAge]
  );

  const listGuestMax = useMemo(() => {
    if (!runtime?.rooms.length) return 12;
    return Math.max(
      1,
      ...runtime.rooms.map((r) => r.maxCapacity || r.capacity || 1)
    );
  }, [runtime]);

  const listFilterActive = Boolean((checkIn && checkOut) || childCount > 0);

  const filteredRooms = useMemo(() => {
    if (!runtime) return [];
    return filterRoomsForStay(runtime.rooms, {
      checkIn,
      checkOut,
      adults: guestCount,
      children: childCount,
      youngestAge: childCount > 0 ? youngestChildAge : null,
      bookings: runtime.bookings,
      closedDates: runtime.closedDates,
      restrictions: runtime.restrictions,
    });
  }, [runtime, checkIn, checkOut, guestCount, childCount, youngestChildAge]);

  const changeGuests = useCallback(
    (delta: number) => {
      const max = selectedRoom
        ? selectedRoom.maxCapacity || selectedRoom.capacity
        : listGuestMax;
      setGuestCount((g) => {
        const next = g + delta;
        if (next < 1) return g;
        if (next + childCount > max) {
          if (delta > 0 && selectedRoom) {
            showPublicToast(`Максимум для цього котеджу: ${max} гостей (дорослі + діти)`);
          }
          return g;
        }
        return next;
      });
    },
    [selectedRoom, childCount, listGuestMax]
  );

  const changeChildren = useCallback(
    (delta: number) => {
      const max = selectedRoom
        ? selectedRoom.maxCapacity || selectedRoom.capacity
        : listGuestMax;
      setChildCount((c) => {
        const next = c + delta;
        if (next < 0) return c;
        if (guestCount + next > max) {
          if (delta > 0 && selectedRoom) {
            showPublicToast(`Максимум для цього котеджу: ${max} гостей (дорослі + діти)`);
          }
          return c;
        }
        if (c === 0 && next > 0) {
          setYoungestChildAgeState(DEFAULT_YOUNGEST_CHILD_AGE);
        }
        return next;
      });
    },
    [selectedRoom, guestCount, listGuestMax]
  );

  const changeYoungestChildAge = useCallback((delta: number) => {
    setYoungestChildAgeState((age) =>
      Math.max(0, Math.min(MAX_CHILD_AGE, age + delta))
    );
  }, []);

  const setYoungestChildAge = useCallback((age: number) => {
    setYoungestChildAgeState(Math.max(0, Math.min(MAX_CHILD_AGE, Math.round(age))));
  }, []);

  const setServiceQty = useCallback((serviceId: number, qty: number) => {
    setSelectedServices((prev) => ({ ...prev, [String(serviceId)]: Math.max(0, qty) }));
  }, []);

  const availableServices = useMemo(
    () => listServicesForRoom(runtime?.customServicesList, selectedRoom),
    [runtime?.customServicesList, selectedRoom]
  );

  const showChildren = true;

  const childrenPolicyMessage = useMemo(
    () =>
      selectedRoom
        ? childrenPolicyViolationMessage(selectedRoom, childCount, youngestChildAge)
        : null,
    [selectedRoom, childCount, youngestChildAge]
  );
  const childrenPolicyBlocked = Boolean(childrenPolicyMessage);

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

  // When dates + room form a post-late gap stay, lock arrival after previous late checkout.
  useEffect(() => {
    if (!selectedRoom || !runtime || !checkIn || !checkOut) {
      return;
    }
    const ranges = getBookedRanges(runtime.bookings, selectedRoom);
    const prev = findPrevLateCheckoutRange(checkIn, ranges);
    if (!prev) {
      if (postLateArrivalTime) setPostLateArrivalTime(null);
      return;
    }
    const arrival = arrivalAfterLateCheckout(prev.lateTime);
    if (postLateArrivalTime !== arrival) setPostLateArrivalTime(arrival);
    if (lateTime) {
      setLateTime(null);
      setLateActive(false);
    }
  }, [selectedRoom, runtime, checkIn, checkOut, postLateArrivalTime, lateTime]);

  const priceResult = useMemo(() => {
    if (!selectedRoom || !settings || !checkIn || !checkOut || !runtime) {
      return {
        price: null as PublicPriceBreakdown | null,
        error: null as string | null,
        postLateGapNotice: null as string | null,
        postLateArrivalTime: null as string | null,
        isPostLateGapStay: false,
      };
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
      selectedPostLateArrivalTime: postLateArrivalTime,
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
      return {
        price: null,
        error: calc.overlapReason || "Дати зайняті",
        postLateGapNotice: calc.postLateGapNoticeHtml || null,
        postLateArrivalTime: calc.postLateArrivalTime,
        isPostLateGapStay: calc.isPostLateGapStay,
      };
    }
    if (calc.restrViolation) {
      return {
        price: null,
        error: `Мінімум ${calc.requiredMinNights} ${nightWord(calc.requiredMinNights)}`,
        postLateGapNotice: calc.postLateGapNoticeHtml || null,
        postLateArrivalTime: calc.postLateArrivalTime,
        isPostLateGapStay: calc.isPostLateGapStay,
      };
    }
    const prepaymentPolicy = readPrepaymentPolicy(data.branding);
    const prepayment = calculatePrepaymentAmount(prepaymentPolicy, {
      totalPrice: calc.totalPrice,
      basePriceTotal: calc.basePriceTotal,
      nights: calc.nights,
      nightlyBasePrices: calc.nightlyBasePrices,
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
        serviceLines: calc.serviceLines,
      },
      error: null,
      postLateGapNotice: calc.postLateGapNoticeHtml || null,
      postLateArrivalTime: calc.postLateArrivalTime,
      isPostLateGapStay: calc.isPostLateGapStay,
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
    postLateArrivalTime,
    data.branding,
  ]);

  const proceedDisabled =
    !checkIn || !checkOut || Boolean(priceResult.error) || childrenPolicyBlocked;
  let proceedLabel = "Оберіть дати";
  if (checkIn && !checkOut) {
    const ranges =
      selectedRoom && runtime ? getBookedRanges(runtime.bookings, selectedRoom) : [];
    const gapOnCheckIn = findPrevLateCheckoutRange(checkIn, ranges);
    if (gapOnCheckIn) {
      proceedLabel = "Оберіть дату виїзду";
    } else {
      const min = selectedRoom
        ? getRestrictionMinNights(runtime?.restrictions || {}, selectedRoom.id, checkIn)
        : 0;
      proceedLabel = min > 1 ? `Мінімум ${min} ${nightWord(min)}` : "Оберіть дату виїзду";
    }
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

      const policyMsg = childrenPolicyViolationMessage(
        selectedRoom,
        childCount,
        youngestChildAge
      );
      if (policyMsg) {
        showPublicToast(policyMsg);
        return;
      }

      const calc = priceResult.price;
      let fullComment = comment.trim();
      const servicesById = new Map(
        (runtime?.customServicesList || []).map((s) => [s.id, s] as const)
      );
      const parts: string[] = [];
      const childrenToken = buildChildrenCommentToken(
        childCount,
        childCount > 0 ? youngestChildAge : null
      );
      if (childrenToken) parts.push(childrenToken);
      parts.push(
        ...buildServiceCommentTokens(selectedServices, servicesById, { isPublicBooking: true })
      );
      if (earlyTime && !postLateArrivalTime) {
        parts.push(
          buildEarlyCommentToken(earlyTime, flexibleSchedule.requiresApproval)
        );
      }
      if (postLateArrivalTime) {
        parts.push(buildPostLateCommentToken(postLateArrivalTime));
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

      const manualReview =
        !isPublicOnlinePaymentEnabled() ||
        needsManualReview({
          nights: calc.nights,
          earlyTime,
          lateTime,
          flexibleRequiresApproval: flexibleSchedule.requiresApproval,
          selectedServices,
          servicesById: new Map(
            (runtime?.customServicesList || []).map((s) => [String(s.id), s] as const)
          ),
          hasUbd,
          isPostLateGapStay: Boolean(postLateArrivalTime || priceResult.isPostLateGapStay),
        });

      const payload: SubmitBookingPayload = {
        tenant_id: data.tenantId,
        checkIn: formatDateKey(checkIn),
        checkOut: formatDateKey(checkOut),
        // Chessboard name («Будиночок 7»), not the public listing name — the
        // whole admin side and every notification key off this value.
        cottage: adminRoomCottageValue(selectedRoom) || selectedRoom.name,
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
          !isPublicOnlinePaymentEnabled() ||
          json.flow === "pending_review" ||
          manualReview
            ? "pending_review"
            : "instant";
        const orderId = String(json.orderId || "").trim();
        if (!orderId) {
          showPublicToast("❌ Бронювання створено без номера. Зверніться до адміністратора.");
          return;
        }
        const paymentAmount = Math.round(Number(json.prepayment) || calc.prepayment || 0);

        const sessionData = {
          orderId,
          flow,
          // Guest-facing screens keep the public listing name.
          cottage: selectedRoom.name,
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
            // Do not delay payment page while TurboSMS processes the message.
            void ensurePaymentLinkSms(orderId).catch((error) => {
              console.warn("[Booking] Payment link SMS will be retried", {
                orderId,
                error,
              });
            });
            showPublicToast("Бронювання створено. Оберіть спосіб оплати…");
            window.location.assign(`/pay/${encodeURIComponent(orderId)}`);
          } catch {
            showPublicToast(
              "Бронювання створено. Відкриваємо сторінку оплати…"
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
      youngestChildAge,
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
    selectStayDate,
    clearStayDates,
    guestCount,
    changeGuests,
    childCount,
    changeChildren,
    youngestChildAge,
    changeYoungestChildAge,
    setYoungestChildAge,
    filteredRooms,
    listFilterActive,
    listGuestMax,
    availableServices,
    selectedServices,
    setServiceQty,
    showChildren,
    childrenPolicyMessage,
    childrenPolicyBlocked,
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
    postLateGapNotice: priceResult.postLateGapNotice,
    postLateArrivalTime: priceResult.postLateArrivalTime,
    isPostLateGapStay: priceResult.isPostLateGapStay,
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

