import type { BookingRecord } from "./types";
import {
  getTimelineOneNightFinAriaLabel,
  getTimelineOneNightFinKind,
  type TimelineOneNightFinKind,
} from "./bookingUtils";

/** Вертикальний зазор картки від краю рядка. */
export const TIMELINE_BOOKING_BLOCK_INSET = 7;
export const TIMELINE_BOOKING_BLOCK_INSET_FOCUS = 2;

export function getTimelineBookingBlockInset(focusLayout = false): number {
  return focusLayout ? TIMELINE_BOOKING_BLOCK_INSET_FOCUS : TIMELINE_BOOKING_BLOCK_INSET;
}

export function getTimelineBookingBlockLayout(rowHeight: number, focusLayout = false) {
  const inset = getTimelineBookingBlockInset(focusLayout);
  return {
    top: inset,
    height: rowHeight - inset * 2,
  } as const;
}

export const TIMELINE_BOOKING_BLOCK_LAYOUT = {
  top: TIMELINE_BOOKING_BLOCK_INSET,
  height: `calc(100% - ${TIMELINE_BOOKING_BLOCK_INSET * 2}px)`,
} as const;

export type TimelineBookingCardBlock = {
  nights: number;
  contentWidth: number;
  guestName: string;
  guestChip: string | null;
  finText: string;
  finBadge: { bg: string; color: string };
  booking: BookingRecord;
};

/** У compact-рядку горизонтальний layout не вміщає ім’я + chip + ціну. */
export const TIMELINE_COMPACT_STACKED_CONTENT_MAX_WIDTH = 115;

export function shouldUseCompactStackedMultiNightLayout(block: TimelineBookingCardBlock): boolean {
  return block.nights >= 2 && block.contentWidth < TIMELINE_COMPACT_STACKED_CONTENT_MAX_WIDTH;
}

type TimelineBookingCardContentProps = {
  block: TimelineBookingCardBlock;
  mobile?: boolean;
  compact?: boolean;
};

function GuestChipIcon() {
  return (
    <svg className="booking-guest-chip-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function GuestChip({
  value,
  compact = false,
  textOnly = false,
}: {
  value: string;
  compact?: boolean;
  textOnly?: boolean;
}) {
  return (
    <span
      className={`booking-guest-chip${compact ? " booking-guest-chip--compact" : ""}${textOnly ? " booking-guest-chip--text" : ""}`}
      aria-label={`Гостей: ${value}`}
    >
      {textOnly ? null : <GuestChipIcon />}
      {value}
    </span>
  );
}

function OneNightFinIcon() {
  return (
    <svg className="booking-fin-icon__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function OneNightFinBadge({
  finBadge,
  kind,
}: {
  finBadge: { bg: string; color: string };
  kind: TimelineOneNightFinKind;
}) {
  if (kind === "neutral") {
    return (
      <span className="booking-fin-badge booking-fin-badge--one-night-icon booking-fin-badge--one-night-neutral">
        —
      </span>
    );
  }

  return (
    <span
      className="booking-fin-badge booking-fin-badge--one-night-icon"
      style={{
        background: finBadge.bg,
        color: finBadge.color,
      }}
      aria-label={getTimelineOneNightFinAriaLabel(kind)}
      title={getTimelineOneNightFinAriaLabel(kind)}
    >
      {kind === "paid" ? <OneNightFinIcon /> : "!"}
    </span>
  );
}

function PriceBadge({
  finText,
  finBadge,
}: {
  finText: string;
  finBadge: { bg: string; color: string };
}) {
  return (
    <span
      className="booking-fin-badge"
      style={{
        background: finBadge.bg,
        color: finBadge.color,
      }}
    >
      {finText}
    </span>
  );
}

/** Сума → гості, в один ряд, ідеально вирівняні. */
function MobileMetaRow({
  block,
  showGuestChip,
  oneNightFinKind,
  textOnly,
}: {
  block: TimelineBookingCardBlock;
  showGuestChip: boolean;
  oneNightFinKind: TimelineOneNightFinKind | null;
  textOnly: boolean;
}) {
  return (
    <div className="booking-mobile-meta-row">
      {oneNightFinKind ? (
        <OneNightFinBadge finBadge={block.finBadge} kind={oneNightFinKind} />
      ) : (
        <PriceBadge finText={block.finText} finBadge={block.finBadge} />
      )}
      {showGuestChip && block.guestChip ? (
        <GuestChip value={block.guestChip} compact textOnly={textOnly} />
      ) : null}
    </div>
  );
}

export function resolveTimelineGuestChipVisibility(block: TimelineBookingCardBlock) {
  return { showGuestChip: Boolean(block.guestChip) };
}

function CompactStackedStayCard({
  block,
  showGuestChip,
}: {
  block: TimelineBookingCardBlock;
  showGuestChip: boolean;
}) {
  return (
    <div className="booking-inner-content booking-inner-content--compact booking-inner-content--compact-short-stay">
      <div className="booking-guest-name">{block.guestName}</div>
      <div className="booking-compact-short-stay-meta">
        {showGuestChip && block.guestChip ? (
          <GuestChip value={block.guestChip} compact textOnly={block.contentWidth < 72} />
        ) : null}
        <span
          className="booking-fin-badge"
          style={{
            background: block.finBadge.bg,
            color: block.finBadge.color,
          }}
        >
          {block.finText}
        </span>
      </div>
    </div>
  );
}

export function TimelineBookingCardContent({
  block,
  mobile = false,
  compact = false,
}: TimelineBookingCardContentProps) {
  const isOneNight = block.nights === 1;
  const { showGuestChip } = resolveTimelineGuestChipVisibility(block);
  const oneNightFinKind = isOneNight ? getTimelineOneNightFinKind(block.booking) : null;
  const guestTextOnly = block.contentWidth < 72;

  /** Dense mobile: 1-night — only price + guests, no name. */
  if (mobile && compact && isOneNight) {
    return (
      <div className="booking-inner-content booking-inner-content--mobile-dense booking-inner-content--mobile-dense-meta-only">
        <MobileMetaRow
          block={block}
          showGuestChip={showGuestChip}
          oneNightFinKind={oneNightFinKind}
          textOnly
        />
      </div>
    );
  }

  /** Dense mobile: short multi-night — meta only (no name). */
  if (mobile && compact && block.nights < 3) {
    return (
      <div className="booking-inner-content booking-inner-content--mobile-dense booking-inner-content--mobile-dense-meta-only">
        <MobileMetaRow
          block={block}
          showGuestChip={showGuestChip}
          oneNightFinKind={null}
          textOnly={guestTextOnly || block.contentWidth < 96}
        />
      </div>
    );
  }

  /** Expanded mobile: name (if multi) + price then guests, perfectly aligned. */
  if (mobile && !compact) {
    return (
      <div
        className={[
          "booking-inner-content",
          "booking-inner-content--mobile",
          "booking-inner-content--mobile-expanded",
          isOneNight ? "booking-inner-content--mobile-expanded-one-night" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {!isOneNight ? <div className="booking-guest-name">{block.guestName}</div> : null}
        <MobileMetaRow
          block={block}
          showGuestChip={showGuestChip}
          oneNightFinKind={oneNightFinKind}
          textOnly={guestTextOnly || isOneNight}
        />
      </div>
    );
  }

  if (isOneNight && !mobile) {
    return (
      <div
        className={[
          "booking-inner-content",
          compact
            ? "booking-inner-content--compact booking-inner-content--compact-one-night"
            : "booking-inner-content--one-night-stack",
        ].join(" ")}
      >
        <div className="booking-guest-name">{block.guestName}</div>
        <div className="booking-compact-one-night-foot">
          {oneNightFinKind ? (
            <OneNightFinBadge finBadge={block.finBadge} kind={oneNightFinKind} />
          ) : null}
          {showGuestChip && block.guestChip ? (
            <GuestChip value={block.guestChip} compact textOnly={guestTextOnly} />
          ) : null}
        </div>
      </div>
    );
  }

  if (compact && shouldUseCompactStackedMultiNightLayout(block)) {
    return <CompactStackedStayCard block={block} showGuestChip={showGuestChip} />;
  }

  if (compact) {
    return (
      <div className="booking-inner-content booking-inner-content--compact">
        <div className="booking-guest-name">{block.guestName}</div>
        {showGuestChip && block.guestChip ? (
          <GuestChip value={block.guestChip} compact textOnly={guestTextOnly} />
        ) : null}
        <PriceBadge finText={block.finText} finBadge={block.finBadge} />
      </div>
    );
  }

  return (
    <div
      className={[
        "booking-inner-content",
        isOneNight ? "booking-inner-content--one-night" : "",
        showGuestChip ? "booking-inner-content--has-guests" : "",
        mobile ? "booking-inner-content--mobile" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="booking-card-top">
        <div className="booking-guest-name">{block.guestName}</div>
        {showGuestChip && block.guestChip ? (
          <GuestChip value={block.guestChip} textOnly={guestTextOnly} />
        ) : null}
      </div>
      <div className="booking-card-bottom">
        {oneNightFinKind ? (
          <OneNightFinBadge finBadge={block.finBadge} kind={oneNightFinKind} />
        ) : (
          <PriceBadge finText={block.finText} finBadge={block.finBadge} />
        )}
      </div>
    </div>
  );
}
