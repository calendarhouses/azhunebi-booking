"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  expireAdminSession,
  isAdminUnauthorizedError,
} from "@/lib/admin/adminSession";
import { adminApiFetch, saveAdminSettings } from "../adminApi";
import { showToast } from "../adminGlobals";
import { API_URL } from "../constants";
import type {
  AdminSettingsPayload,
  BookingRecord,
  RoomConfig,
  TransactionConfig,
} from "../types";
import { closeCustomConfirm, openCustomConfirm } from "./confirmDialog";
import { computeAnalytics } from "./computeAnalytics";
import { captureFinanceReportCard } from "./financeReportCard";
import { gatherFinanceReport } from "./gatherFinanceReport";
import {
  destroyReportCharts,
  renderReportCharts,
  updateRoomsChartMode,
} from "./renderCharts";
import {
  formatFinanceReportPeriodDisplay,
  getReportPeriodDates,
  REPORT_PERIOD_LABELS,
} from "./reportPeriod";
import type {
  AnalyticsResult,
  BosoDetailKey,
  FinanceReportModalType,
  ReportPeriod,
  ReportTab,
  RoomsChartMode,
} from "./types";
import { createFlatpickr, type FlatpickrInstance } from "../flatpickrAdmin";

export type UseReportsAnalyticsParams = {
  bookings: BookingRecord[];
  transactions: TransactionConfig[];
  roomsList: RoomConfig[];
  customPrices: AdminSettingsPayload["customPrices"];
  settings: AdminSettingsPayload;
  onSettingsChange: (settings: AdminSettingsPayload) => void;
  onOpenBooking: (event: React.MouseEvent | null, row: number | string) => void;
  isActive?: boolean;
};

export type InlineCardDraft = { amount: string; date: string; comment: string };

export type UniDetailsState = {
  open: boolean;
  title: string;
  colorHex: string;
  bgHex: string;
  valLabel: string;
  type: BosoDetailKey;
};

const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "current", label: REPORT_PERIOD_LABELS.current },
  { value: "prev", label: REPORT_PERIOD_LABELS.prev },
  { value: "next", label: REPORT_PERIOD_LABELS.next },
  { value: "year", label: REPORT_PERIOD_LABELS.year },
  { value: "all", label: REPORT_PERIOD_LABELS.all },
];

export function useReportsAnalytics(params: UseReportsAnalyticsParams) {
  const {
    bookings,
    transactions,
    roomsList,
    customPrices,
    settings,
    onSettingsChange,
    onOpenBooking,
    isActive = true,
  } = params;

  const [reportTab, setReportTab] = useState<ReportTab>("finance");
  const [period, setPeriod] = useState<ReportPeriod>("current");
  const [periodLabel, setPeriodLabel] = useState(REPORT_PERIOD_LABELS.current);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);
  const [roomsChartMode, setRoomsChartMode] = useState<RoomsChartMode>("count");
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [financeView, setFinanceView] = useState<"table" | "cards">("table");
  const [inlineCardType, setInlineCardType] = useState<"income" | "expense" | null>(null);
  const [expandedInlineCard, setExpandedInlineCard] = useState<number | null>(null);
  const [inlineDrafts, setInlineDrafts] = useState<Record<number, InlineCardDraft>>({});
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<InlineCardDraft | null>(null);
  const [uniDetails, setUniDetails] = useState<UniDetailsState | null>(null);
  const [financeReportModal, setFinanceReportModal] = useState<FinanceReportModalType | null>(
    null
  );
  const [financeReportError, setFinanceReportError] = useState("");
  const [tgSending, setTgSending] = useState(false);
  const [periodSelectOpen, setPeriodSelectOpen] = useState(false);

  const reportRangePickerRef = useRef<FlatpickrInstance | null>(null);
  const analyticsRef = useRef<AnalyticsResult | null>(null);
  const financeReportErrorRef = useRef("");

  const periodDisplay = useMemo(() => {
    const { startDate, endDate } = getReportPeriodDates(period, periodLabel, customRange);
    return formatFinanceReportPeriodDisplay(period, periodLabel, startDate, endDate);
  }, [period, periodLabel, customRange]);

  const recompute = useCallback(() => {
    const result = computeAnalytics({
      bookings,
      transactions,
      roomsList,
      customPrices,
      period,
      periodLabel,
      customRange,
    });
    setAnalytics(result);
    analyticsRef.current = result;
    if (typeof window !== "undefined") {
      window.bosoDetails = result.details;
    }
    return result;
  }, [bookings, transactions, roomsList, customPrices, period, periodLabel, customRange]);

  useEffect(() => {
    if (!isActive) return;
    const result = recompute();
    if (reportTab === "analytics") {
      requestAnimationFrame(() => {
        renderReportCharts(result, roomsChartMode);
      });
    }
  }, [isActive, recompute, reportTab, roomsChartMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    reportRangePickerRef.current = createFlatpickr("#customReportRange", {
      mode: "range",
      dateFormat: "Y-m-d",
      onChange: (selectedDates: Date[]) => {
        if (selectedDates.length === 2) {
          setPeriod("custom");
          const d1 = selectedDates[0].toLocaleDateString("uk-UA", {
            day: "numeric",
            month: "long",
          });
          const d2 = selectedDates[1].toLocaleDateString("uk-UA", {
            day: "numeric",
            month: "long",
          });
          setPeriodLabel(`${d1} — ${d2}`);
          setCustomRange({ start: selectedDates[0], end: selectedDates[1] });
        }
      },
    });
    (window as Window & { reportRangePicker?: typeof reportRangePickerRef.current }).reportRangePicker =
      reportRangePickerRef.current;

    return () => {
      reportRangePickerRef.current?.clear?.();
    };
  }, []);

  const persistTransactions = useCallback(
    async (next: TransactionConfig[]) => {
      const nextSettings = { ...settings, transactions: next };
      onSettingsChange(nextSettings);
      if (typeof window !== "undefined") window.transactions = next;
      try {
        await saveAdminSettings(nextSettings, { keys: ["transactions"] });
      } catch (e) {
        if (isAdminUnauthorizedError(e)) {
          await expireAdminSession();
          return;
        }
        showToast("Помилка збереження налаштувань!");
      }
    },
    [settings, onSettingsChange]
  );

  const selectPeriod = useCallback(
    (value: ReportPeriod, label: string) => {
      setUniDetails(null);
      setPeriod(value);
      setPeriodLabel(label);
      setPeriodSelectOpen(false);
      if (value !== "custom") {
        setCustomRange(null);
        reportRangePickerRef.current?.clear();
      }
    },
    []
  );

  const switchReportTab = useCallback((tab: ReportTab) => {
    setUniDetails(null);
    setReportTab(tab);
  }, []);

  const toggleRoomsChart = useCallback(
    (mode: RoomsChartMode) => {
      setRoomsChartMode(mode);
      if (analyticsRef.current) {
        updateRoomsChartMode(mode, analyticsRef.current);
      }
    },
    []
  );

  const openUniversalDetails = useCallback(
    (
      type: BosoDetailKey,
      title: string,
      colorHex: string,
      bgHex: string,
      valLabel: string
    ) => {
      setUniDetails({ open: true, type, title, colorHex, bgHex, valLabel });
    },
    []
  );

  const closeUniversalDetails = useCallback(() => {
    setUniDetails(null);
  }, []);

  const sortedUniDetails = useMemo(() => {
    if (!uniDetails || !analytics) return [];
    const data = [...(analytics.details[uniDetails.type] || [])];
    data.sort((a, b) => a.rawDate - b.rawDate);
    return data;
  }, [uniDetails, analytics]);

  const openFinanceInlineCards = useCallback((type: "income" | "expense") => {
    setInlineCardType(type);
    setFinanceView("cards");
    setExpandedInlineCard(null);
    setInlineDrafts({});
    setTimeout(() => {
      document.getElementById("financeCardsWrap")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 350);
  }, []);

  const openFinanceTable = useCallback(() => {
    setFinanceView("table");
    setInlineCardType(null);
    setExpandedInlineCard(null);
    setTimeout(() => {
      document.querySelector(".finance-summary")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 350);
  }, []);

  const toggleInlineCard = useCallback((index: number) => {
    setExpandedInlineCard((prev) => {
      const next = prev === index ? null : index;
      if (next !== null) {
        setTimeout(() => {
          document.getElementById(`itCard-${index}`)?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 150);
      }
      return next;
    });
  }, []);

  const saveInlineTransaction = useCallback(
    async (type: "income" | "expense", category: string, idx: number) => {
      const draft = inlineDrafts[idx];
      const amount =
        parseInt(
          (document.getElementById(`itAmt-${idx}`) as HTMLInputElement | null)?.value ||
            draft?.amount ||
            "0",
          10
        ) || 0;
      const dateInput =
        (document.getElementById(`itDate-${idx}`) as HTMLInputElement | null)?.value ||
        draft?.date ||
        "";
      const comment = (draft?.comment || "").trim();
      if (amount <= 0) {
        showToast("Сума має бути більше нуля!");
        return;
      }
      const next: TransactionConfig[] = [
        ...transactions,
        {
          id: Date.now(),
          type,
          category,
          amount,
          date: dateInput,
          comment,
        },
      ];
      await persistTransactions(next);
      showToast("Запис успішно додано!");
      openFinanceTable();
    },
    [inlineDrafts, transactions, persistTransactions, openFinanceTable]
  );

  const toggleEditFinRow = useCallback(
    (id: number) => {
      if (editingTxId === id) {
        setEditingTxId(null);
        setEditDraft(null);
        return;
      }
      const t = transactions.find((x) => x.id === id);
      if (!t) return;
      setEditingTxId(id);
      setEditDraft({
        amount: String(t.amount),
        date: String(t.date),
        comment: t.comment || "",
      });
      setTimeout(() => {
        document.getElementById(`mainRow-${id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    },
    [editingTxId, transactions]
  );

  const saveInlineEdit = useCallback(
    async (id: number) => {
      const t = transactions.find((x) => x.id === id);
      if (!t || !editDraft) return;
      const newAmt =
        parseInt(
          (document.getElementById(`editAmt-${id}`) as HTMLInputElement | null)?.value ||
            editDraft.amount,
          10
        ) || 0;
      const newDate =
        (document.getElementById(`editDate-${id}`) as HTMLInputElement | null)?.value ||
        editDraft.date;
      const newComm =
        (document.getElementById(`editComm-${id}`) as HTMLInputElement | null)?.value?.trim() ||
        editDraft.comment.trim();
      if (newAmt <= 0) {
        showToast("Сума має бути більше нуля!");
        return;
      }
      const next = transactions.map((x) =>
        x.id === id
          ? { ...x, amount: newAmt, date: newDate, comment: newComm }
          : x
      );
      await persistTransactions(next);
      setEditingTxId(null);
      setEditDraft(null);
      showToast("Зміни успішно збережено!");
    },
    [transactions, editDraft, persistTransactions]
  );

  const deleteTransaction = useCallback(
    (id: number) => {
      openCustomConfirm(
        "Видалити транзакцію?",
        "Ви впевнені? Цю дію неможливо скасувати.",
        async () => {
          closeCustomConfirm();
          const next = transactions.filter((t) => t.id !== id);
          await persistTransactions(next);
          showToast("Успішно видалено!");
        }
      );
    },
    [transactions, persistTransactions]
  );

  const jumpToFinanceAndEdit = useCallback(
    (id: number) => {
      closeUniversalDetails();
      setReportTab("finance");
      setFinanceView("table");
      setTimeout(() => {
        toggleEditFinRow(id);
      }, 400);
    },
    [closeUniversalDetails, toggleEditFinRow]
  );

  const showFinanceReportResultModal = useCallback((type: FinanceReportModalType) => {
    setFinanceReportModal(type);
  }, []);

  const closeFinanceReportResultModal = useCallback(() => {
    setFinanceReportModal(null);
  }, []);

  const downloadFinanceReportToTelegram = useCallback(async () => {
    setTgSending(true);
    try {
      const report = gatherFinanceReport({
        bookings,
        transactions,
        period,
        periodLabel,
        customRange,
      });
      if (
        !report ||
        (report.bookingsCount === 0 &&
          report.totalIncome === 0 &&
          report.totalExpense === 0)
      ) {
        showFinanceReportResultModal("empty");
        return;
      }

      let customStart = "";
      let customEnd = "";
      if (
        period === "custom" &&
        reportRangePickerRef.current?.selectedDates?.length === 2
      ) {
        customStart = reportRangePickerRef.current.formatDate(
          reportRangePickerRef.current.selectedDates[0],
          "Y-m-d"
        );
        customEnd = reportRangePickerRef.current.formatDate(
          reportRangePickerRef.current.selectedDates[1],
          "Y-m-d"
        );
      }

      financeReportErrorRef.current = "";
      setFinanceReportError("");
      const screenshot = await captureFinanceReportCard(report);
      if (!screenshot) {
        const msg = "Не вдалося згенерувати картку звіту. Спробуйте ще раз.";
        financeReportErrorRef.current = msg;
        setFinanceReportError(msg);
        showFinanceReportResultModal("error");
        return;
      }

      const res = await adminApiFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "sendFinanceReport",
          period,
          periodLabel: report.periodLabel,
          customStart,
          customEnd,
          screenshot,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      if (data.success) {
        showFinanceReportResultModal("success");
      } else if (data.error === "NO_SCREENSHOT") {
        const msg = "Сервер не отримав зображення.";
        financeReportErrorRef.current = msg;
        setFinanceReportError(msg);
        showFinanceReportResultModal("error");
      } else if (data.error === "TELEGRAM") {
        const msg = data.message || "Telegram відхилив повідомлення.";
        financeReportErrorRef.current = msg;
        setFinanceReportError(msg);
        showFinanceReportResultModal("error");
      } else {
        const msg = data.message || data.error || "Помилка на сервері.";
        financeReportErrorRef.current = msg;
        setFinanceReportError(msg);
        showFinanceReportResultModal("error");
      }
    } catch (e) {
      if (isAdminUnauthorizedError(e)) {
        await expireAdminSession();
        return;
      }
      console.error("Finance report error:", e);
      const msg = "Помилка з'єднання з API.";
      financeReportErrorRef.current = msg;
      setFinanceReportError(msg);
      showFinanceReportResultModal("error");
    } finally {
      setTgSending(false);
    }
  }, [
    bookings,
    transactions,
    period,
    periodLabel,
    customRange,
    showFinanceReportResultModal,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & {
      calculateAnalytics?: () => void;
      switchReportTab?: (tab: string, el?: Element | null) => void;
      getReportPeriodDates?: () => unknown;
      gatherFinanceReportForPeriod?: () => unknown;
      downloadFinanceReportToTelegram?: () => Promise<void>;
      openUniversalDetails?: typeof openUniversalDetails;
      closeUniversalDetails?: typeof closeUniversalDetails;
      openFinanceInlineCards?: typeof openFinanceInlineCards;
      openFinanceTable?: typeof openFinanceTable;
      toggleInlineCard?: typeof toggleInlineCard;
      toggleEditFinRow?: typeof toggleEditFinRow;
      saveInlineEdit?: typeof saveInlineEdit;
      jumpToFinanceAndEdit?: typeof jumpToFinanceAndEdit;
      closeFinanceReportResultModal?: typeof closeFinanceReportResultModal;
      captureFinanceReportCard?: typeof captureFinanceReportCard;
      globalCatIcons?: Record<string, string>;
    };

    w.calculateAnalytics = () => {
      recompute();
    };
    w.switchReportTab = (tab: string) => switchReportTab(tab as ReportTab);
    w.getReportPeriodDates = () => {
      const r = analyticsRef.current?.periodRange;
      if (r) return r;
      return { period, periodLabel, startDate: new Date(), endDate: new Date() };
    };
    w.gatherFinanceReportForPeriod = () =>
      gatherFinanceReport({ bookings, transactions, period, periodLabel, customRange });
    w.downloadFinanceReportToTelegram = downloadFinanceReportToTelegram;
    w.openUniversalDetails = openUniversalDetails;
    w.closeUniversalDetails = closeUniversalDetails;
    w.openFinanceInlineCards = openFinanceInlineCards;
    w.openFinanceTable = openFinanceTable;
    w.toggleInlineCard = toggleInlineCard;
    w.toggleEditFinRow = toggleEditFinRow;
    w.saveInlineEdit = saveInlineEdit;
    w.jumpToFinanceAndEdit = jumpToFinanceAndEdit;
    w.closeFinanceReportResultModal = closeFinanceReportResultModal;
    w.captureFinanceReportCard = captureFinanceReportCard as (r: unknown) => Promise<string | null>;

    return () => {
      destroyReportCharts();
    };
  }, [
    recompute,
    switchReportTab,
    downloadFinanceReportToTelegram,
    openUniversalDetails,
    closeUniversalDetails,
    openFinanceInlineCards,
    openFinanceTable,
    toggleInlineCard,
    toggleEditFinRow,
    saveInlineEdit,
    jumpToFinanceAndEdit,
    closeFinanceReportResultModal,
    bookings,
    transactions,
    period,
    periodLabel,
    customRange,
  ]);

  useEffect(() => {
    if (!financeReportModal) return;
    const icon = document.getElementById("financeReportModalIcon");
    const title = document.getElementById("financeReportModalTitle");
    const desc = document.getElementById("financeReportModalDesc");
    const modal = document.getElementById("financeReportResultModal");
    if (!icon || !title || !desc || !modal) return;

    if (financeReportModal === "success") {
      icon.style.background = "#ECFDF5";
      icon.style.color = "#059669";
      icon.innerHTML =
        '<svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>';
      title.innerText = "Звіт надіслано!";
      desc.innerText = "Преміум-картка з фінансами вже у вашому Telegram-чаті.";
    } else if (financeReportModal === "empty") {
      icon.style.background = "#FEF3C7";
      icon.style.color = "#D97706";
      icon.innerHTML =
        '<svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
      title.innerText = "Немає даних";
      desc.innerText = "За обраний період ще немає фінансових операцій для звіту.";
    } else {
      icon.style.background = "#FEE2E2";
      icon.style.color = "#DC2626";
      icon.innerHTML =
        '<svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
      title.innerText = "Не вдалося надіслати";
      desc.innerText =
        financeReportError || financeReportErrorRef.current || "Спробуйте ще раз або оновіть сторінку.";
    }
    modal.classList.add("active");
  }, [financeReportModal, financeReportError]);

  return {
    reportTab,
    switchReportTab,
    period,
    periodLabel,
    periodDisplay,
    periodOptions: PERIOD_OPTIONS,
    periodSelectOpen,
    setPeriodSelectOpen,
    selectPeriod,
    roomsChartMode,
    toggleRoomsChart,
    analytics,
    financeView,
    inlineCardType,
    expandedInlineCard,
    inlineDrafts,
    setInlineDrafts,
    editingTxId,
    editDraft,
    setEditDraft,
    uniDetails,
    sortedUniDetails,
    openUniversalDetails,
    closeUniversalDetails,
    openFinanceInlineCards,
    openFinanceTable,
    toggleInlineCard,
    saveInlineTransaction,
    toggleEditFinRow,
    saveInlineEdit,
    deleteTransaction,
    jumpToFinanceAndEdit,
    downloadFinanceReportToTelegram,
    tgSending,
    closeFinanceReportResultModal,
    onOpenBooking,
  };
}

declare global {
  interface Window {
    bosoDetails?: import("./types").BosoDetails;
    reportRangePicker?: {
      selectedDates: Date[];
      clear: () => void;
      formatDate: (date: Date, format: string) => string;
    };
    getReportPeriodDates?: () => unknown;
    gatherFinanceReportForPeriod?: () => unknown;
    downloadFinanceReportToTelegram?: () => Promise<void>;
    openUniversalDetails?: (
      type: BosoDetailKey,
      title: string,
      colorHex: string,
      bgHex: string,
      valLabel: string
    ) => void;
    closeUniversalDetails?: () => void;
    openFinanceInlineCards?: (type: "income" | "expense") => void;
    openFinanceTable?: () => void;
    toggleInlineCard?: (index: number) => void;
    toggleEditFinRow?: (id: number) => void;
    saveInlineEdit?: (id: number) => void;
    jumpToFinanceAndEdit?: (id: number) => void;
    closeFinanceReportResultModal?: () => void;
  }
}
