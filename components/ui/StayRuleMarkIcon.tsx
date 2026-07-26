import type { StayRuleMark } from "@/lib/public-booking/stayRules";

type Props = {
  mark: StayRuleMark;
  size?: number;
  className?: string;
};

/** Marker icon for house-rule lines (admin editor + public rules page). */
export function StayRuleMarkIcon({ mark, size = 15, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {mark === "check" ? (
        <path d="m5 12.8 4.4 4.4L19 7.6" />
      ) : mark === "dash" ? (
        <path d="M6 12h12" />
      ) : (
        <path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" />
      )}
    </svg>
  );
}
