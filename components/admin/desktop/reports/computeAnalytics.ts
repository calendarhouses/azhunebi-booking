import { parseSafeDate, formatPhone } from "../adminDates";
import { calculateAccrualBalances } from "@/lib/admin/accrualBalances";
import {
  isSurchargeType,
  paidUntilDate,
  paymentsInPeriod,
} from "@/lib/admin/bookingPayments";
import { getDayPrice } from "../bookingPriceEngine";
import { activeBookingPhrase, otherCheckInDatePhrase } from "../adminPlural";
import type {
  AdminSettingsPayload,
  BookingRecord,
  CustomServiceConfig,
  RoomConfig,
  TransactionConfig,
} from "../types";
import {
  formatFinanceReportPeriodDisplay,
  getAnalyticsPeriodRange,
  isBookingCheckInInPeriod,
} from "./reportPeriod";
import {
  attributeBookingServiceFees,
  matchServiceByCategoryName,
  serviceDetailKey,
} from "./serviceFeeAttribution";
import type {
  AnalyticsResult,
  BosoDetailItem,
  BosoDetails,
  FinanceTableRow,
  ReportPeriod,
} from "./types";
import { emptyBosoDetails } from "./types";

export type ComputeAnalyticsInput = {
  bookings: BookingRecord[];
  transactions: TransactionConfig[];
  roomsList: RoomConfig[];
  customPrices: AdminSettingsPayload["customPrices"];
  customServicesList?: CustomServiceConfig[];
  period: ReportPeriod;
  periodLabel: string;
  customRange?: { start: Date; end: Date } | null;
};

function buildBookingBaseObj(b: BookingRecord): Omit<BosoDetailItem, "amount"> {
  const cName = String(b.name).replace(" (Ручна бронь)", "").trim() || "Клієнт";
  const cPhone = formatPhone(String(b.phone || ""));
  const inD = parseSafeDate(String(b.checkIn));
  const outD = parseSafeDate(String(b.checkOut));
  const fIn = inD.toLocaleDateString("uk-UA", { day: "numeric", month: "long" }).replace(".", "");
  const fOut = outD.toLocaleDateString("uk-UA", { day: "numeric", month: "long" }).replace(".", "");
  return {
    name: cName,
    phone: cPhone,
    date: `${fIn} — ${fOut}`,
    row: b.row,
    isTrans: false,
    rawDate: inD.getTime(),
  };
}

type PaymentCounters = {
  totalIncome: number;
  statFOP: number;
  statCard: number;
  statCash: number;
};

function addPeriodPaymentStats(
  b: BookingRecord,
  baseObj: Omit<BosoDetailItem, "amount">,
  startDate: Date,
  endDate: Date,
  paid: number,
  details: BosoDetails,
  counters: PaymentCounters
): void {
  const periodPays = paymentsInPeriod(b, startDate, endDate);
  periodPays.forEach((p) => {
    const pAmt = Math.round(Number(p.amount) || 0);
    if (pAmt <= 0) return;
    counters.totalIncome += pAmt;
    const pMethod = p.method || "ФОП";
    const typeSuffix = isSurchargeType(p.type) ? " (Доплата)" : " (Аванс)";
    if (pMethod === "ФОП") {
      counters.statFOP += pAmt;
      details.fop.push({ ...baseObj, amount: pAmt, name: baseObj.name + typeSuffix });
    } else if (pMethod === "Картка") {
      counters.statCard += pAmt;
      details.card.push({ ...baseObj, amount: pAmt, name: baseObj.name + typeSuffix });
    } else {
      counters.statCash += pAmt;
      details.cash.push({ ...baseObj, amount: pAmt, name: baseObj.name + typeSuffix });
    }
  });

  if (periodPays.length === 0) {
    const pAmt = Number(b.prepayAmount) || Number(b.paidAmount) || 0;
    const pMethod = String(b.prepayMethod || "ФОП");
    if (pAmt > 0) {
      counters.totalIncome += Math.round(pAmt);
      if (pMethod === "ФОП") {
        counters.statFOP += Math.round(pAmt);
        details.fop.push({ ...baseObj, amount: Math.round(pAmt), name: `${baseObj.name} (Аванс)` });
      } else if (pMethod === "Картка") {
        counters.statCard += Math.round(pAmt);
        details.card.push({ ...baseObj, amount: Math.round(pAmt), name: `${baseObj.name} (Аванс)` });
      } else {
        counters.statCash += Math.round(pAmt);
        details.cash.push({ ...baseObj, amount: Math.round(pAmt), name: `${baseObj.name} (Аванс)` });
      }
    }
    const sAmt = Number(b.surchargeAmount) || 0;
    const sMethod = String(b.surchargeMethod || "Готівка");
    if (sAmt > 0) {
      counters.totalIncome += Math.round(sAmt);
      if (sMethod === "ФОП") {
        counters.statFOP += Math.round(sAmt);
        details.fop.push({ ...baseObj, amount: Math.round(sAmt), name: `${baseObj.name} (Доплата)` });
      } else if (sMethod === "Картка") {
        counters.statCard += Math.round(sAmt);
        details.card.push({ ...baseObj, amount: Math.round(sAmt), name: `${baseObj.name} (Доплата)` });
      } else {
        counters.statCash += Math.round(sAmt);
        details.cash.push({ ...baseObj, amount: Math.round(sAmt), name: `${baseObj.name} (Доплата)` });
      }
    }
  }
}

function ensureDetailBucket(details: BosoDetails, key: string): BosoDetailItem[] {
  if (!details[key]) details[key] = [];
  return details[key];
}

export function computeAnalytics(input: ComputeAnalyticsInput): AnalyticsResult {
  const {
    bookings,
    transactions,
    roomsList,
    customPrices,
    customServicesList = [],
    period,
    periodLabel,
    customRange,
  } = input;

  const services = customServicesList || [];
  const serviceNames: Record<string, string> = {};
  services.forEach((s) => {
    serviceNames[String(s.id)] = s.name || `Послуга ${s.id}`;
  });

  const periodRange = getAnalyticsPeriodRange(period, periodLabel, customRange);
  const { startDate, endDate, prevStartDate, prevEndDate } = periodRange;
  const periodDisplay = formatFinanceReportPeriodDisplay(
    period,
    periodLabel,
    startDate,
    endDate
  );
  let bookingsOutsidePeriod = 0;

  let currSum = 0;
  let currCount = 0;
  let currPaid = 0;
  let prevSum = 0;
  let prevCount = 0;
  let statFOP = 0;
  let statCard = 0;
  let statCash = 0;
  let currGuests = 0;
  let currPets = 0;
  let currEarlyLate = 0;
  let currOther = 0;
  let totalIncome = 0;
  let totalExpense = 0;
  const serviceRevenue: Record<string, number> = {};
  const incomeBreakdown = {
    base: 0,
    guests: 0,
    pets: 0,
    earlyLate: 0,
    services: {} as Record<string, number>,
  };
  const details: BosoDetails = emptyBosoDetails();

  const globalRoomCounts: Record<string, number> = {};
  const globalRoomMoney: Record<string, number> = {};
  const globalRoomNights: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  const revenueTimeline: Record<string, number> = {};
  const topRoomsCount: Record<string, number> = {};

  roomsList.forEach((r) => {
    globalRoomCounts[r.name] = 0;
    globalRoomMoney[r.name] = 0;
    globalRoomNights[r.name] = 0;
  });
  ["Адмінка", "Instagram", "Telegram Бот", "Сайт", "Hutshub"].forEach((s) => {
    sourceCounts[s] = 0;
  });

  bookings.forEach((b) => {
    if (String(b.status).toLowerCase().includes("скас")) return;
    const checkIn = String(b.checkIn);
    const bDate = parseSafeDate(checkIn);
    const price = Number(b.totalPrice) || 0;
    const paid = paidUntilDate(b, endDate);
    const inPeriod = isBookingCheckInInPeriod(checkIn, startDate, endDate);

    if (!inPeriod) {
      bookingsOutsidePeriod++;
    } else {
      currSum += price;
      currPaid += paid;
      currCount++;

      if (b.cottage) {
        const matchedRoom = roomsList.find(
          (r) => String(b.cottage).includes(r.name) || String(b.cottage).includes(r.short)
        );
        const roomName = matchedRoom ? matchedRoom.name : String(b.cottage);
        topRoomsCount[roomName] = (topRoomsCount[roomName] || 0) + 1;
      }

      const baseObj = buildBookingBaseObj(b);

      if (price > 0) details.sum.push({ ...baseObj, amount: price });
      if (paid > 0) details.paid.push({ ...baseObj, amount: paid });

      const payCounters: PaymentCounters = { totalIncome, statFOP, statCard, statCash };
      addPeriodPaymentStats(b, baseObj, startDate, endDate, paid, details, payCounters);
      totalIncome = payCounters.totalIncome;
      statFOP = payCounters.statFOP;
      statCard = payCounters.statCard;
      statCash = payCounters.statCash;

      details.count.push({ ...baseObj, amount: 0 });

      const balance = price - paid;
      if (balance > 0 && price > 0) details.debt.push({ ...baseObj, amount: balance });

      const inD = parseSafeDate(String(b.checkIn));
      const outD = parseSafeDate(String(b.checkOut));
      const nights = Math.max(1, Math.round((outD.getTime() - inD.getTime()) / 86400000));

      const room = roomsList.find((r) => b.cottage && String(b.cottage).includes(r.short));
      const cap = room ? room.capacity : 2;
      const extraPrice =
        room && room.extraGuestPrice !== undefined ? room.extraGuestPrice : 2500;

      const extraGuests = Math.max(0, (parseInt(String(b.guests), 10) || 2) - cap);
      const feeGuests =
        b.extraGuestFee !== undefined && b.extraGuestFee !== ""
          ? Number(b.extraGuestFee)
          : extraGuests * extraPrice * nights;
      const feePets =
        b.petFee !== undefined && b.petFee !== ""
          ? Number(b.petFee)
          : b.pets === "Так" || b.pets === true
            ? 500 + 200 * nights
            : 0;

      if (feeGuests > 0) {
        currGuests += feeGuests;
        details.guests.push({ ...baseObj, amount: feeGuests });
      }
      if (feePets > 0) {
        currPets += feePets;
        details.pets.push({ ...baseObj, amount: feePets });
      }

      const { lines: serviceLines, leftoverOther } = attributeBookingServiceFees({
        booking: b,
        services,
        nights,
      });
      let bookingServicesTotal = 0;
      for (const line of serviceLines) {
        serviceRevenue[line.id] = (serviceRevenue[line.id] || 0) + line.amount;
        if (!serviceNames[line.id]) serviceNames[line.id] = line.name;
        bookingServicesTotal += line.amount;
        ensureDetailBucket(details, serviceDetailKey(line.id)).push({
          ...baseObj,
          amount: line.amount,
          name: `${baseObj.name} (${line.name})`,
        });
      }
      if (leftoverOther > 0) {
        currOther += leftoverOther;
        details.other.push({
          ...baseObj,
          amount: leftoverOther,
          name: `${baseObj.name} (Інші послуги)`,
        });
      }

      let feeEarlyLate = 0;
      if (
        (b.earlyFee !== undefined && b.earlyFee !== "") ||
        (b.lateFee !== undefined && b.lateFee !== "")
      ) {
        feeEarlyLate = (Number(b.earlyFee) || 0) + (Number(b.lateFee) || 0);
      } else {
        const rawComment = b.comment ? String(b.comment) : "";
        if (rawComment.includes("🕒 Ранній заїзд:") && room) {
          feeEarlyLate += Math.round(getDayPrice(room, inD, customPrices) * 0.5);
        }
        if (rawComment.includes("🕒 Пізній виїзд:") && room) {
          feeEarlyLate += Math.round(getDayPrice(room, outD, customPrices) * 0.5);
        }
      }
      if (feeEarlyLate > 0) {
        currEarlyLate += feeEarlyLate;
        details.earlyLate.push({ ...baseObj, amount: feeEarlyLate });
      }

      if (paid > 0) {
        const ratio = price > 0 ? paid / price : 1;
        incomeBreakdown.pets += feePets * ratio;
        incomeBreakdown.guests += feeGuests * ratio;
        incomeBreakdown.earlyLate += feeEarlyLate * ratio;
        let servicesPaid = 0;
        for (const line of serviceLines) {
          const part = line.amount * ratio;
          incomeBreakdown.services[line.id] = (incomeBreakdown.services[line.id] || 0) + part;
          servicesPaid += part;
        }
        const leftoverPaid = leftoverOther * ratio;
        incomeBreakdown.base +=
          paid -
          feePets * ratio -
          feeGuests * ratio -
          feeEarlyLate * ratio -
          servicesPaid -
          leftoverPaid;
      }

      if (b.cottage) {
        const matchedRoom = roomsList.find(
          (r) => String(b.cottage).includes(r.name) || String(b.cottage).includes(r.short)
        );
        const roomName = matchedRoom ? matchedRoom.name : String(b.cottage);
        globalRoomCounts[roomName] = (globalRoomCounts[roomName] || 0) + 1;
        globalRoomMoney[roomName] = (globalRoomMoney[roomName] || 0) + price;
        globalRoomNights[roomName] = (globalRoomNights[roomName] || 0) + nights;
      }
      const src = String(b.source || "Адмінка");
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
      const rawDateKey = `${bDate.getFullYear()}-${String(bDate.getMonth() + 1).padStart(2, "0")}-${String(bDate.getDate()).padStart(2, "0")}`;
      revenueTimeline[rawDateKey] = (revenueTimeline[rawDateKey] || 0) + price;
      void bookingServicesTotal;
    }

    if (
      prevStartDate &&
      prevEndDate &&
      isBookingCheckInInPeriod(checkIn, prevStartDate, prevEndDate)
    ) {
      prevSum += price;
      prevCount++;
    }
  });

  const filteredTrans = transactions
    .filter((t) => {
      const tDate = parseSafeDate(String(t.date));
      return tDate >= startDate && tDate <= endDate;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  filteredTrans.forEach((t) => {
    const tDate = parseSafeDate(String(t.date));
    if (t.type === "income") {
      totalIncome += t.amount;
      const tObj: BosoDetailItem = {
        name: t.comment || "Додано вручну",
        phone: "",
        date: tDate.toLocaleDateString("uk-UA", { day: "numeric", month: "long" }),
        row: null,
        amount: t.amount,
        isTrans: true,
        id: t.id,
        rawDate: tDate.getTime(),
      };
      if (t.category === "Плата за раннє заселення/пізнє виселення") {
        currEarlyLate += t.amount;
        details.earlyLate.push(tObj);
      } else if (t.category === "Додаткові гості") {
        currGuests += t.amount;
        details.guests.push(tObj);
      } else if (t.category === "Домашні тварини") {
        currPets += t.amount;
        details.pets.push(tObj);
      } else {
        const matched = matchServiceByCategoryName(String(t.category || ""), services);
        if (matched) {
          const id = String(matched.id);
          serviceRevenue[id] = (serviceRevenue[id] || 0) + t.amount;
          serviceNames[id] = matched.name || serviceNames[id] || `Послуга ${id}`;
          ensureDetailBucket(details, serviceDetailKey(id)).push(tObj);
        } else if (t.category === "Інший дохід" || t.category === "Міні-бар") {
          currOther += t.amount;
          details.other.push(tObj);
        } else {
          currOther += t.amount;
          details.other.push(tObj);
        }
      }
    } else {
      totalExpense += t.amount;
    }
  });

  const currDebt = Math.max(0, currSum - currPaid);
  const accrual = calculateAccrualBalances(bookings, endDate, startDate);
  details.creditor = accrual.creditorItems;
  details.accrualDebtor = accrual.debtorItems;
  const profit = totalIncome - totalExpense;

  let bestRoom = "не визначено";
  let maxReservations = 0;
  for (const r in topRoomsCount) {
    if (topRoomsCount[r] > maxReservations) {
      maxReservations = topRoomsCount[r];
      bestRoom = r;
    }
  }
  const servicesTotal = Object.values(serviceRevenue).reduce((s, v) => s + v, 0);
  const extraTotal = currPets + currGuests + currEarlyLate + currOther + servicesTotal;
  let aiSummaryHtml = "";
  if (currSum === 0 && currCount === 0) {
    if (bookingsOutsidePeriod > 0 && period !== "all") {
      const rangeHint = periodDisplay ? ` (${periodDisplay})` : "";
      aiSummaryHtml =
        `У звіті враховуються броні з <b>датою заїзду</b> у періоді${rangeHint}. ` +
        `Є ${activeBookingPhrase(bookingsOutsidePeriod)} ${otherCheckInDatePhrase(bookingsOutsidePeriod)} — обери «За весь рік», інший місяць або власний діапазон.`;
    } else {
      aiSummaryHtml = "За обраний період даних ще немає. Час запускати нову хвилю бронювань.";
    }
  } else {
    let text = "";
    if (currSum > prevSum && prevSum > 0) {
      text = `Дохід зріс на ${Math.round(((currSum - prevSum) / prevSum) * 100)}% за період. `;
    } else if (currSum < prevSum && prevSum > 0) {
      text = `Дохід знизився на ${Math.round(((prevSum - currSum) / prevSum) * 100)}% за період. `;
    } else {
      text = `Загальний дохід: ${currSum.toLocaleString("uk-UA")} грн. `;
    }
    aiSummaryHtml = `${text}Хіт продажів — <b>${bestRoom}</b>. Додаткові послуги принесли <b>${extraTotal.toLocaleString("uk-UA")} грн</b>.`;
  }

  const serviceCardOrder = [
    { id: "cardPets", val: currPets },
    { id: "cardGuests", val: currGuests },
    { id: "cardEarlyLate", val: currEarlyLate },
    { id: "cardOther", val: currOther },
    ...Object.entries(serviceRevenue).map(([id, val]) => ({
      id: `cardSvc-${id}`,
      val,
    })),
  ]
    .sort((a, b) => b.val - a.val)
    .map((s) => ({ id: s.id, val: s.val }));

  const financeRows: FinanceTableRow[] = [];
  const pushSystemRow = (
    title: string,
    desc: string,
    amount: number,
    type: "income" | "expense"
  ) => {
    if (Math.round(amount) <= 0) return;
    financeRows.push({
      key: `sys-${title}`,
      id: null,
      title,
      desc,
      amount,
      type,
      isSystem: true,
    });
  };

  pushSystemRow(
    "Оренда котеджів",
    "Оплачена базова вартість",
    incomeBreakdown.base,
    "income"
  );
  pushSystemRow("Додаткові гості", "Оплати за додаткові місця", incomeBreakdown.guests, "income");
  pushSystemRow("Тварини", "Оплати за розміщення улюбленців", incomeBreakdown.pets, "income");
  pushSystemRow(
    "Гнучкий графік",
    "Ранні заїзди та пізні виїзди",
    incomeBreakdown.earlyLate,
    "income"
  );
  for (const [id, amount] of Object.entries(incomeBreakdown.services)) {
    pushSystemRow(
      serviceNames[id] || `Послуга ${id}`,
      "Додаткова послуга",
      amount,
      "income"
    );
  }

  filteredTrans.forEach((t) => {
    const dateStr = parseSafeDate(String(t.date)).toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "long",
    });
    financeRows.push({
      key: `tx-${t.id}`,
      id: t.id,
      title: t.category,
      desc: t.comment || dateStr,
      amount: t.amount,
      type: t.type,
      isSystem: false,
      transaction: t,
    });
  });

  return {
    metrics: {
      currSum,
      currCount,
      currPaid,
      currDebt,
      creditorTotal: accrual.creditorTotal,
      debtorTotal: accrual.debtorTotal,
      accrualSnapshotLabel: accrual.snapshotLabel,
      prevSum,
      prevCount,
      statFOP,
      statCard,
      statCash,
      currGuests,
      currPets,
      currEarlyLate,
      serviceRevenue,
      serviceNames,
      currOther,
      totalIncome,
      totalExpense,
      profit,
      incomeBreakdown,
      aiSummaryHtml,
      serviceCardOrder,
      topRoomsCount,
    },
    details,
    financeRows,
    filteredTransactions: filteredTrans,
    charts: {
      rooms: { counts: globalRoomCounts, money: globalRoomMoney, nights: globalRoomNights },
      sources: { sources: sourceCounts },
      revenue: { timeline: revenueTimeline },
    },
    periodRange,
    periodDisplay,
    bookingsOutsidePeriod,
  };
}
