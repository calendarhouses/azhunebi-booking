"use client";

import { useEffect, useRef, useState } from "react";
import {
  guestPhoneKey,
  guestRatingMeta,
  type GuestProfile,
  type GuestRating,
} from "@/lib/admin/guestProfiles";

type Props = {
  phone: string;
  profile: GuestProfile | null;
  onChange: (patch: { rating?: GuestRating | null; note?: string | null }) => void;
  compact?: boolean;
};

const RATINGS: GuestRating[] = [3, 2, 1];

export function GuestReputationControls({ phone, profile, onChange, compact }: Props) {
  const hasPhone = Boolean(guestPhoneKey(phone));
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState(profile?.note || "");
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(profile?.note || "");
  }, [profile?.note, phone]);

  useEffect(() => {
    if (!noteOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node)) setNoteOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [noteOpen]);

  const active = profile?.rating;
  const hasNote = Boolean(String(profile?.note || "").trim());

  return (
    <div className={`guest-rep${compact ? " guest-rep--compact" : ""}${hasPhone ? "" : " is-disabled"}`}>
      <div className="guest-rep__ratings" role="group" aria-label="Рейтинг гостя">
        {RATINGS.map((r) => {
          const meta = guestRatingMeta(r)!;
          const selected = active === r;
          return (
            <button
              key={r}
              type="button"
              className={`guest-rep__face guest-rep__face--${meta.tone}${selected ? " is-selected" : ""}`}
              title={hasPhone ? meta.label : "Спочатку вкажіть телефон"}
              disabled={!hasPhone}
              aria-pressed={selected}
              onClick={() => {
                if (!hasPhone) return;
                onChange({ rating: selected ? null : r });
              }}
            >
              <span aria-hidden>{meta.emoji}</span>
            </button>
          );
        })}
      </div>

      <div className="guest-rep__note-wrap" ref={popRef}>
        <button
          type="button"
          className={`guest-rep__note-btn${hasNote ? " has-note" : ""}`}
          disabled={!hasPhone}
          title={hasPhone ? (hasNote ? "Редагувати коментар" : "Коментар про гостя") : "Спочатку вкажіть телефон"}
          aria-expanded={noteOpen}
          onClick={() => {
            if (!hasPhone) return;
            setNoteOpen((v) => !v);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-6 8l-4-4V6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4z" />
          </svg>
          {!compact ? <span>{hasNote ? "Коментар" : "Нотатка"}</span> : null}
          {hasNote ? <span className="guest-rep__note-dot" aria-hidden /> : null}
        </button>

        {noteOpen ? (
          <div className="guest-rep__popover" role="dialog" aria-label="Коментар про гостя">
            <div className="guest-rep__popover-title">Коментар про гостя</div>
            <textarea
              className="guest-rep__textarea"
              rows={4}
              maxLength={2000}
              placeholder="Наприклад: запізнюється, дуже акуратний, любить тишу…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <div className="guest-rep__popover-actions">
              <button
                type="button"
                className="guest-rep__ghost"
                onClick={() => {
                  setDraft(profile?.note || "");
                  setNoteOpen(false);
                }}
              >
                Скасувати
              </button>
              <button
                type="button"
                className="guest-rep__save"
                onClick={() => {
                  onChange({ note: draft });
                  setNoteOpen(false);
                }}
              >
                Зберегти
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function GuestRatingBadge({
  rating,
  note,
}: {
  rating?: GuestRating | null;
  note?: string | null;
}) {
  const meta = guestRatingMeta(rating);
  const hasNote = Boolean(String(note || "").trim());
  if (!meta && !hasNote) return null;
  return (
    <span className={`guest-badge${meta ? ` guest-badge--${meta.tone}` : ""}`} title={note || meta?.label || ""}>
      {meta ? <span className="guest-badge__emoji">{meta.emoji}</span> : null}
      {hasNote ? <span className="guest-badge__note-icon" aria-hidden>💬</span> : null}
    </span>
  );
}
