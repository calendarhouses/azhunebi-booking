"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock, Flame, ShieldCheck, Tag, Ticket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dedupeDiscountsList } from "@/lib/admin/discountDraft";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload, DiscountKind } from "../types";
import { matchesDiscountFilter, matchesDiscountSection, type DiscountListFilter } from "./discountConfig";
import { DiscountAllGroupedTable, DiscountFilteredTable } from "./DiscountListTables";
import { DiscountTemplatesCollapse } from "./DiscountTemplatesCollapse";
import {
  DISCOUNT_ACTIVE_SECTION_HEADING_ID,
  getMainContentScrollContainer,
  scrollMainContentAfterFilterChange,
  scrollMainContentToDiscountRow,
} from "./scrollMainContent";
import "./settings-discounts.css";

const CARD_CLASS =
  "discount-template-card bg-white rounded-2xl border border-stone-200 p-5 cursor-pointer hover:border-[#5c6b4b] hover:shadow-lg hover:shadow-stone-200/50 transition-[border-color,box-shadow] duration-300 group flex flex-col gap-3 text-left";

export type DiscountTemplateDef = {
  kind: DiscountKind;
  Icon: LucideIcon;
  iconContainerClass: string;
  iconClass: string;
  title: string;
  description: string;
};

export const DISCOUNT_TEMPLATES: DiscountTemplateDef[] = [
  {
    kind: "long_stay",
    Icon: CalendarDays,
    iconContainerClass: "bg-[#f4f5f1]",
    iconClass: "text-[#5c6b4b]",
    title: "Довготривале проживання",
    description:
      "Мотивуй гостей залишатися довше. Наприклад, давай знижку від 3-х діб бронювання.",
  },
  {
    kind: "early_booking",
    Icon: Clock,
    iconContainerClass: "bg-blue-50",
    iconClass: "text-blue-500",
    title: "Раннє бронювання",
    description: "Отримуй гарантовані броні та оплати за кілька місяців до дати заїзду.",
  },
  {
    kind: "last_minute",
    Icon: Flame,
    iconContainerClass: "bg-orange-50",
    iconClass: "text-orange-500",
    title: "Гаряча пропозиція",
    description: "Здай котедж в останній момент зі знижкою, щоб уникнути втрати доходу через простій.",
  },
  {
    kind: "promo_code",
    Icon: Ticket,
    iconContainerClass: "bg-purple-50",
    iconClass: "text-purple-500",
    title: "Промокоди",
    description: "Створюй секретні слова для підписників в Instagram чи лояльних гостей.",
  },
  {
    kind: "ubd",
    Icon: ShieldCheck,
    iconContainerClass: "bg-slate-100",
    iconClass: "text-slate-600",
    title: "Спеціальні тарифи",
    description:
      "Налаштуй фіксовані соціальні знижки (наприклад, для УБД) або приємні бонуси для іменинників.",
  },
];

const FILTER_TAB_IDLE =
  "px-4 py-1.5 rounded-full text-sm font-medium text-stone-500 hover:bg-stone-100 transition-colors shrink-0";

const FILTER_TAB_ACTIVE =
  "px-4 py-1.5 rounded-full text-sm font-medium bg-[#5c6b4b] text-white shadow-md shrink-0";

const FILTER_SCROLL_MS = 380;
/** На «Усі» з довгим списком — при зміні фільтра не скролити в самий низ сторінки. */
const LONG_ALL_LIST_MIN = 4;

type FilterScrollSnapshot = {
  scrollTopBefore: number;
  scrollHeightBefore: number;
  clientHeightBefore: number;
  maxScrollBefore: number;
};

type DiscountTemplateGalleryProps = {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
};

function DiscountListEmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50 mt-4">
      <Tag className="text-stone-300 mb-4" size={32} strokeWidth={1.5} />
      <p className="text-sm text-stone-500 font-medium">{title}</p>
      {subtitle ? <p className="text-xs text-stone-400 mt-1">{subtitle}</p> : null}
    </div>
  );
}

function DiscountTemplateCards({ onSelect }: { onSelect: (kind: DiscountKind) => void }) {
  return (
    <div className="discount-template-cards-grid">
      {DISCOUNT_TEMPLATES.map(({ kind, Icon, iconContainerClass, iconClass, title, description }) => (
        <button key={kind} type="button" className={CARD_CLASS} onClick={() => onSelect(kind)}>
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mb-1 ${iconContainerClass}`}
          >
            <Icon className={iconClass} size={20} strokeWidth={1.5} />
          </div>
          <h3 className="font-semibold text-stone-800">{title}</h3>
          <p className="text-xs text-stone-500 leading-relaxed">{description}</p>
        </button>
      ))}
    </div>
  );
}

export function DiscountTemplateGallery({ settings, modals }: DiscountTemplateGalleryProps) {
  const [listFilter, setListFilter] = useState<DiscountListFilter>("all");
  const filterScrollSnapshotRef = useRef<FilterScrollSnapshot | null>(null);
  const prevAccordionOpenSignalRef = useRef<string | null>(null);
  const accordionScrollTimerRef = useRef<number | null>(null);

  const allDiscounts = dedupeDiscountsList(settings.discountsList || []);
  const isEmpty = allDiscounts.length === 0;

  const activeSections = useMemo(
    () =>
      DISCOUNT_TEMPLATES.map((template) => ({
        template,
        discounts: allDiscounts.filter((d) => matchesDiscountSection(d, template.kind)),
      })).filter(({ discounts }) => discounts.length > 0),
    [allDiscounts]
  );

  const availableFilterTabs = useMemo(() => {
    const tabs: { id: DiscountListFilter; label: string }[] = [{ id: "all", label: "Усі" }];
    for (const template of DISCOUNT_TEMPLATES) {
      const hasDiscounts = allDiscounts.some((d) => matchesDiscountSection(d, template.kind));
      if (hasDiscounts) {
        tabs.push({ id: template.kind, label: template.title });
      }
    }
    return tabs;
  }, [allDiscounts]);

  const isFilterEmpty =
    !isEmpty && listFilter !== "all" && !allDiscounts.some((d) => matchesDiscountFilter(d, listFilter));

  useEffect(() => {
    if (listFilter === "all") return;
    if (!availableFilterTabs.some((tab) => tab.id === listFilter)) {
      setListFilter("all");
    }
  }, [availableFilterTabs, listFilter]);

  useLayoutEffect(() => {
    const snapshot = filterScrollSnapshotRef.current;
    if (!snapshot) return;
    filterScrollSnapshotRef.current = null;

    scrollMainContentAfterFilterChange({
      ...snapshot,
      durationMs: FILTER_SCROLL_MS,
      growScrollElementId:
        listFilter === "all" && allDiscounts.length >= LONG_ALL_LIST_MIN
          ? DISCOUNT_ACTIVE_SECTION_HEADING_ID
          : undefined,
    });
  }, [listFilter, allDiscounts.length]);

  const switchFilter = useCallback(
    (next: DiscountListFilter) => {
      if (next === listFilter) return;

      const main = getMainContentScrollContainer();
      filterScrollSnapshotRef.current = {
        scrollTopBefore: main?.scrollTop ?? 0,
        scrollHeightBefore: main?.scrollHeight ?? 0,
        clientHeightBefore: main?.clientHeight ?? 0,
        maxScrollBefore: main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0,
      };

      setListFilter(next);
    },
    [listFilter]
  );

  const handleTemplateClick = (kind: DiscountKind) => {
    setListFilter("all");
    modals.addDiscountDraft(kind);
  };

  const accordionOpenSignal =
    modals.discountAccordionKey != null
      ? `${modals.discountAccordionKey}:${modals.discountAccordionScrollSeq}`
      : null;

  useEffect(() => {
    if (accordionScrollTimerRef.current != null) {
      window.clearTimeout(accordionScrollTimerRef.current);
      accordionScrollTimerRef.current = null;
    }

    if (accordionOpenSignal == null) {
      prevAccordionOpenSignalRef.current = null;
      return undefined;
    }

    if (accordionOpenSignal === prevAccordionOpenSignalRef.current) {
      return undefined;
    }

    prevAccordionOpenSignalRef.current = accordionOpenSignal;
    const key = Number(accordionOpenSignal.split(":")[0]);
    if (!Number.isFinite(key)) return undefined;

    const scrollKey = key;
    accordionScrollTimerRef.current = window.setTimeout(() => {
      scrollMainContentToDiscountRow(scrollKey, { offset: 16 });
      accordionScrollTimerRef.current = null;
    }, 120);

    return () => {
      if (accordionScrollTimerRef.current != null) {
        window.clearTimeout(accordionScrollTimerRef.current);
        accordionScrollTimerRef.current = null;
      }
    };
  }, [accordionOpenSignal]);

  const listContent =
    listFilter === "all" ? (
      activeSections.length > 0 ? (
        <DiscountAllGroupedTable activeSections={activeSections} settings={settings} modals={modals} />
      ) : null
    ) : isFilterEmpty ? (
      <DiscountListEmptyState title="У цій категорії поки немає знижок" />
    ) : (
      <DiscountFilteredTable sectionKind={listFilter} settings={settings} modals={modals} />
    );

  return (
    <>
      <p className="text-sm text-stone-500 mb-8">
        Налаштуй інструменти продажів, щоб залучати більше гостей та уникати простоїв.
      </p>

      {isEmpty ? (
        <div className="mb-12">
          <DiscountTemplateCards onSelect={handleTemplateClick} />
        </div>
      ) : (
        <DiscountTemplatesCollapse open={modals.discountTemplatesOpen}>
          <DiscountTemplateCards onSelect={handleTemplateClick} />
        </DiscountTemplatesCollapse>
      )}

      <section id="discount-active-section">
        <h2
          id="discount-active-section-heading"
          className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-4"
        >
          ТВОЇ АКТИВНІ ЗНИЖКИ
        </h2>

        {isEmpty ? (
          <DiscountListEmptyState
            title="Тут поки порожньо"
            subtitle="Обери один із шаблонів вище, щоб створити свою першу знижку."
          />
        ) : (
          <>
            <div id="discount-filter-tabs" className="discount-filter-tabs">
              <div className="discount-filter-tabs__track">
              {availableFilterTabs.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={listFilter === id ? FILTER_TAB_ACTIVE : FILTER_TAB_IDLE}
                  onClick={() => switchFilter(id)}
                >
                  {label}
                </button>
              ))}
              </div>
            </div>

            <div className="discount-filter-panel">{listContent}</div>
          </>
        )}
      </section>
    </>
  );
}
