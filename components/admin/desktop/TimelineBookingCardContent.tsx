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
  width: number;
  extensions: { type: "early" | "late"; left: number; width: number }[];
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
  /** Android chessboard: fuller cards (name + price + guests) at denser row heights. */
  androidPremium?: boolean;
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
      <span
        className="booking-fin-badge booking-fin-badge--one-night-icon booking-fin-badge--one-night-neutral"
        aria-label={getTimelineOneNightFinAriaLabel(kind)}
        title={getTimelineOneNightFinAriaLabel(kind)}
      >
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

/** Сума → гості, в один ряд. */
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
  androidPremium = false,
}: TimelineBookingCardContentProps) {
  const isOneNight = block.nights === 1;
  const { showGuestChip } = resolveTimelineGuestChipVisibility(block);
  const oneNightFinKind = isOneNight ? getTimelineOneNightFinKind(block.booking) : null;
  const guestTextOnly = block.contentWidth < 72;
  const name = block.guestName?.trim() || "";

  if (mobile) {
    const flexibleInset = block.extensions.length * (compact ? 16 : 20);
    const effectiveWidth = Math.max(
      0,
      block.width - (compact ? 12 : 20) - flexibleInset
    );
    const nameMinWidth = androidPremium
      ? block.nights === 2
        ? 40
        : 48
      : block.nights === 2
        ? 78
        : 82;
    const showName =
      !isOneNight && Boolean(name) && (androidPremium || effectiveWidth >= nameMinWidth);
    const textOnlyGuests = isOneNight || effectiveWidth < (androidPremium ? 72 : 100);
    const amount = block.finText.replace(/\s*(грн|₴)\s*$/i, "").trim();
    const mobileFinText =
      block.finText === "—"
        ? "—"
        : `${amount}${androidPremium || effectiveWidth >= 68 ? " ₴" : ""}`;
    const stayClass =
      block.nights === 1
        ? "booking-inner-content--stay-1"
        : block.nights === 2
          ? "booking-inner-content--stay-2"
          : "booking-inner-content--stay-3plus";
    return (
      <div
        className={[
          "booking-inner-content",
          "booking-inner-content--mobile-premium",
          compact
            ? "booking-inner-content--mobile-premium-dense"
            : "booking-inner-content--mobile-premium-standard",
          androidPremium ? "booking-inner-content--android-premium" : "",
          stayClass,
          showName ? "" : "booking-inner-content--meta-only",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showName ? <div className="booking-guest-name">{name}</div> : null}
        <MobileMetaRow
          block={{ ...block, finText: mobileFinText }}
          showGuestChip={showGuestChip}
          oneNightFinKind={isOneNight ? oneNightFinKind : null}
          textOnly={textOnlyGuests}
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
