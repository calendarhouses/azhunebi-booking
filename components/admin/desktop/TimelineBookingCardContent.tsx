import type { BookingRecord } from "./types";

/** Вертикальний зазор картки від краю рядка (~10% нижче за повний stretch). */
export const TIMELINE_BOOKING_BLOCK_INSET = 7;

export function getTimelineBookingBlockLayout(rowHeight: number) {
  return {
    top: TIMELINE_BOOKING_BLOCK_INSET,
    height: rowHeight - TIMELINE_BOOKING_BLOCK_INSET * 2,
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

export function resolveTimelineGuestChipVisibility(
  block: TimelineBookingCardBlock,
  compact = false
) {
  if (compact) return { showGuestChip: false };
  return { showGuestChip: Boolean(block.guestChip) && block.nights !== 1 };
}

export function TimelineBookingCardContent({
  block,
  mobile = false,
  compact = false,
}: TimelineBookingCardContentProps) {
  const isOneNight = block.nights === 1;
  const { showGuestChip } = resolveTimelineGuestChipVisibility(block, compact);

  if (compact) {
    return (
      <div className="booking-inner-content booking-inner-content--compact">
        <div className="booking-guest-name">{block.guestName}</div>
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
        {showGuestChip ? (
          <span className="booking-guest-chip" aria-label={`Гостей: ${block.guestChip}`}>
            <GuestChipIcon />
            {block.guestChip}
          </span>
        ) : null}
      </div>
      <div className="booking-card-bottom">
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
