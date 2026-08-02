"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { searchGuests, type GuestRow } from "@/components/admin/desktop/guestData";
import type { BookingRecord } from "@/components/admin/desktop/types";
import { guestRatingMeta, type GuestProfilesMap } from "@/lib/admin/guestProfiles";
import { GuestFaceIcon } from "./GuestIcons";

type Mode = "name" | "phone";

type Props = {
  mode: Mode;
  id: string;
  value: string;
  required?: boolean;
  bookings: BookingRecord[];
  guestProfiles?: GuestProfilesMap | null;
  onChange: (value: string) => void;
  onPickGuest: (guest: GuestRow) => void;
};

/**
 * Suggestions are filtered client-side from bookings already in admin
 * memory — no extra GAS round-trip per keystroke. See guestData.ts.
 */
export function GuestAutocompleteField({
  mode,
  id,
  value,
  required,
  bookings,
  guestProfiles,
  onChange,
  onPickGuest,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const matches = useMemo(
    () => searchGuests(bookings, value, 8, guestProfiles),
    [bookings, value, guestProfiles]
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showList = open && matches.length > 0;

  const pick = (guest: GuestRow) => {
    onPickGuest(guest);
    setOpen(false);
  };

  return (
    <div className={`guest-ac${mode === "name" ? " guest-ac--name" : ""}`} ref={rootRef}>
      <input
        type={mode === "phone" ? "tel" : "text"}
        id={id}
        required={required}
        autoComplete="off"
        value={value}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && matches[activeIdx]) {
            e.preventDefault();
            pick(matches[activeIdx]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {mode === "name" ? (
        <span className="guest-ac__hint" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.25" stroke="#9CA3AF" strokeWidth="1.7" />
            <path
              d="M5.5 18.2c1.4-2.4 3.5-3.6 6.5-3.6s5.1 1.2 6.5 3.6"
              stroke="#9CA3AF"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path d="M17.2 16.2 19 18l2-2" stroke="#9CA3AF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
      {showList ? (
        <ul id={listId} className="guest-ac__list" role="listbox">
          {matches.map((g, idx) => {
            const meta = guestRatingMeta(g.rating);
            const initial = (g.name || "?").charAt(0).toUpperCase();
            return (
              <li key={g.phone}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === activeIdx}
                  className={`guest-ac__option${idx === activeIdx ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => pick(g)}
                >
                  <span className="guest-ac__avatar" aria-hidden>
                    {initial}
                  </span>
                  <span className="guest-ac__option-main">
                    <span className="guest-ac__name">
                      {g.name || "Без імені"}
                      {meta ? (
                        <span className="guest-ac__rating">
                          <GuestFaceIcon rating={g.rating!} size={14} />
                        </span>
                      ) : null}
                    </span>
                    <span className="guest-ac__phone">+{g.phone}</span>
                  </span>
                  <span className="guest-ac__meta">
                    {g.count} {g.count === 1 ? "візит" : g.count < 5 ? "візити" : "візитів"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
