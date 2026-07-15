"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PublicDiscount } from "@/lib/public-booking/types";
import {
  getPublicRoomDiscounts,
  PublicDiscountCard,
} from "@/lib/public-booking/publicDiscountDisplay";

const VISIBLE_LIMIT = 10;

type PublicDiscountsSectionProps = {
  roomId: number;
  discounts: PublicDiscount[];
  resetKey?: string | number;
};

export function PublicDiscountsSection({
  roomId,
  discounts,
  resetKey,
}: PublicDiscountsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [resetKey]);

  const roomDiscounts = useMemo(
    () => getPublicRoomDiscounts(roomId, discounts),
    [discounts, roomId]
  );

  if (!roomDiscounts.length) return null;

  const hasMore = roomDiscounts.length > VISIBLE_LIMIT;
  const hiddenCount = roomDiscounts.length - VISIBLE_LIMIT;
  const visibleDiscounts = expanded ? roomDiscounts : roomDiscounts.slice(0, VISIBLE_LIMIT);

  return (
    <>
      <div className="divider" />
      <h3 className="section-title">Знижки</h3>
      <div className="cards-categories" id="detailDiscounts">
        <section className="cards-category cards-category--solo">
          <div className="rules-grid cards-category__grid discounts-grid">
            {visibleDiscounts.map((discount) => (
              <PublicDiscountCard key={discount.id} discount={discount} />
            ))}
          </div>
        </section>
      </div>
      {hasMore ? (
        <button
          type="button"
          className={`cards-show-more${expanded ? " is-expanded" : ""}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span className="cards-show-more__label">{expanded ? "Згорнути" : "Показати ще"}</span>
          {!expanded ? <span className="cards-show-more__count">+{hiddenCount}</span> : null}
          <ChevronDown className="cards-show-more__chevron" aria-hidden strokeWidth={2} />
        </button>
      ) : null}
    </>
  );
}
