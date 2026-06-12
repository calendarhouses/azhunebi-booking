import type { ReactNode } from "react";

export type LineIconProps = {
  children: ReactNode;
  className?: string;
  size?: number;
};

/** Єдиний stroke-діалект для адмінки (як BookMeNow, але щільніший). */
export function LineIcon({ children, className = "h-5 w-5", size }: LineIconProps) {
  const dim = size ? { width: size, height: size } : undefined;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...dim}
    >
      {children}
    </svg>
  );
}
