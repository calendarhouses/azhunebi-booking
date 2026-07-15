"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const VISIBLE_LIMIT = 10;

export type PublicCardGroup = {
  id: string;
  title: string;
  items: ReactNode[];
};

type PublicCategorizedCardsSectionProps = {
  sectionTitle: string;
  groups: PublicCardGroup[];
  resetKey?: string | number;
  listId?: string;
};

function sliceGroupsByLimit(groups: PublicCardGroup[], limit: number, expanded: boolean): PublicCardGroup[] {
  if (expanded) return groups;

  let remaining = limit;
  const result: PublicCardGroup[] = [];

  for (const group of groups) {
    if (remaining <= 0) break;
    const items = group.items.slice(0, remaining);
    if (!items.length) continue;
    result.push({ ...group, items });
    remaining -= items.length;
  }

  return result;
}

export function PublicCategorizedCardsSection({
  sectionTitle,
  groups,
  resetKey,
  listId,
}: PublicCategorizedCardsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [resetKey]);

  const nonEmptyGroups = useMemo(
    () => groups.filter((group) => group.items.length > 0),
    [groups]
  );

  const totalCount = useMemo(
    () => nonEmptyGroups.reduce((sum, group) => sum + group.items.length, 0),
    [nonEmptyGroups]
  );

  if (!totalCount) return null;

  const hasMore = totalCount > VISIBLE_LIMIT;
  const hiddenCount = totalCount - VISIBLE_LIMIT;
  const visibleGroups = sliceGroupsByLimit(nonEmptyGroups, VISIBLE_LIMIT, expanded);

  return (
    <>
      <div className="divider" />
      <h3 className="section-title">{sectionTitle}</h3>
      <div className="cards-categories" id={listId}>
        {visibleGroups.map((group) => (
          <section key={group.id} className="cards-category" aria-labelledby={`${listId}-${group.id}-title`}>
            <h4 className="cards-category__title" id={`${listId}-${group.id}-title`}>
              {group.title}
            </h4>
            <div className="rules-grid cards-category__grid">{group.items}</div>
          </section>
        ))}
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
