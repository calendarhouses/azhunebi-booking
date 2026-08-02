import type { GuestRating } from "@/lib/admin/guestProfiles";

type FaceProps = {
  rating: GuestRating;
  size?: number;
  className?: string;
};

/** Custom face icons (not OS emoji) — green / amber / red. */
export function GuestFaceIcon({ rating, size = 18, className }: FaceProps) {
  const tone =
    rating === 3 ? "good" : rating === 2 ? "neutral" : "bad";
  const fill =
    rating === 3 ? "#5B8A4C" : rating === 2 ? "#C9A227" : "#C45B5B";
  const soft =
    rating === 3 ? "#E7F3E2" : rating === 2 ? "#FBF3D7" : "#F9E4E4";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      data-tone={tone}
    >
      <circle cx="12" cy="12" r="10" fill={soft} stroke={fill} strokeWidth="1.6" />
      {rating === 3 ? (
        <>
          <circle cx="8.5" cy="10" r="1.35" fill={fill} />
          <circle cx="15.5" cy="10" r="1.35" fill={fill} />
          <path
            d="M8.2 14.2c1.1 1.5 2.4 2.2 3.8 2.2s2.7-.7 3.8-2.2"
            fill="none"
            stroke={fill}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {rating === 2 ? (
        <>
          <circle cx="8.5" cy="10" r="1.35" fill={fill} />
          <circle cx="15.5" cy="10" r="1.35" fill={fill} />
          <path
            d="M8.4 15.2h7.2"
            fill="none"
            stroke={fill}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      ) : null}
      {rating === 1 ? (
        <>
          <path
            d="M7.4 9.2c.55-.7 1.35-1.1 2.2-1.1M14.4 8.1c.85 0 1.65.4 2.2 1.1"
            fill="none"
            stroke={fill}
            strokeWidth="1.55"
            strokeLinecap="round"
          />
          <circle cx="8.5" cy="10.6" r="1.25" fill={fill} />
          <circle cx="15.5" cy="10.6" r="1.25" fill={fill} />
          <path
            d="M8.2 16.4c1.1-1.45 2.4-2.15 3.8-2.15s2.7.7 3.8 2.15"
            fill="none"
            stroke={fill}
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </>
      ) : null}
    </svg>
  );
}

export function GuestCommentIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M6.5 18.5 4.2 20.4a.9.9 0 0 1-1.45-.72V7.2A3.2 3.2 0 0 1 5.95 4h12.1A3.2 3.2 0 0 1 21.25 7.2v6.1a3.2 3.2 0 0 1-3.2 3.2H9.1l-2.6 2z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 9.2h8M8 12.4h5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
