import React from "react";

export const KhataBrandIcon = ({
  className = "w-8 h-8 shrink-0 text-[#7a9248] mr-4",
  viewBox = "0 0 24 24",
}: {
  className?: string;
  viewBox?: string;
}) => (
  <svg
    viewBox={viewBox}
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Димар (з відступом від даху) */}
    <path d="M 3.5 2 L 6.5 2 L 6.5 6 L 3.5 9 Z" />

    {/* Головні стіни та дах */}
    <path d="M 2 22 L 2 12 L 12 2 L 22 12 L 22 22 L 19 22 L 19 13 L 12 6 L 5 13 L 5 22 Z" />

    {/* Арка (двері) */}
    <path d="M 9.5 22 L 9.5 16 A 2.5 2.5 0 0 1 14.5 16 L 14.5 22 Z" />
  </svg>
);
