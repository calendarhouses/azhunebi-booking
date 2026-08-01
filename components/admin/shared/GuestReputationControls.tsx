"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  guestPhoneKey,
  guestRatingMeta,
  type GuestProfile,
  type GuestRating,
} from "@/lib/admin/guestProfiles";
import { useMobileUi } from "@/components/admin/mobile/MobileUiContext";
import { GuestCommentIcon, GuestFaceIcon } from "./GuestIcons";

type Props = {
  phone: string;
  profile: GuestProfile | null;
  onChange: (patch: { rating?: GuestRating | null; note?: string | null }) => void;
  compact?: boolean;
};

const RATINGS: GuestRating[] = [3, 2, 1];

type PopoverPos = { top: number; left: number; width: number };

export function GuestReputationControls({ phone, profile, onChange, compact }: Props) {
  const isMobile = useMobileUi();
  const hasPhone = Boolean(guestPhoneKey(phone));
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState(profile?.note || "");
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null);
  const noteBtnRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft(profile?.note || "");
  }, [profile?.note, phone]);

  useLayoutEffect(() => {
    if (!noteOpen || isMobile) {
      setPopoverPos(null);
      return;
    }
    const update = () => {
      const btn = noteBtnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const width = Math.min(320, Math.max(260, window.innerWidth - 24));
      let left = rect.right - width;
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      let top = rect.bottom + 8;
      const estimatedHeight = 240;
      if (top + estimatedHeight > window.innerHeight - 12) {
        top = Math.max(12, rect.top - estimatedHeight - 8);
      }
      setPopoverPos({ top, left, width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [noteOpen, isMobile]);

  useEffect(() => {
    if (!noteOpen || isMobile) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (noteBtnRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      setNoteOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [noteOpen, isMobile]);

  useEffect(() => {
    if (!noteOpen || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [noteOpen, isMobile]);

  const active = profile?.rating;
  const hasNote = Boolean(String(profile?.note || "").trim());

  const closeNote = () => {
    setDraft(profile?.note || "");
    setNoteOpen(false);
  };

  const saveNote = () => {
    onChange({ note: draft });
    setNoteOpen(false);
  };

  const noteEditor = (
    <>
      <div className="guest-rep__popover-title">Коментар про гостя</div>
      <textarea
        className="guest-rep__textarea"
        rows={5}
        maxLength={500}
        placeholder="Наприклад: запізнюється, дуже акуратний, любить тишу…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <div className="guest-rep__popover-actions">
        <button type="button" className="guest-rep__ghost" onClick={closeNote}>
          Скасувати
        </button>
        <button type="button" className="guest-rep__save" onClick={saveNote}>
          Зберегти
        </button>
      </div>
    </>
  );

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
              <GuestFaceIcon rating={r} size={compact ? 18 : 20} />
            </button>
          );
        })}
      </div>

      <div className="guest-rep__note-wrap">
        <button
          ref={noteBtnRef}
          type="button"
          className={`guest-rep__note-btn${hasNote ? " has-note" : ""}`}
          disabled={!hasPhone}
          title={
            hasPhone
              ? hasNote
                ? "Редагувати коментар"
                : "Коментар про гостя"
              : "Спочатку вкажіть телефон"
          }
          aria-expanded={noteOpen}
          onClick={() => {
            if (!hasPhone) return;
            setNoteOpen((v) => !v);
          }}
        >
          <GuestCommentIcon size={15} />
          {!compact ? <span>{hasNote ? "Коментар" : "Нотатка"}</span> : null}
          {hasNote ? <span className="guest-rep__note-dot" aria-hidden /> : null}
        </button>
      </div>

      {noteOpen && !isMobile && popoverPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              className="guest-rep__popover guest-rep__popover--portal"
              role="dialog"
              aria-label="Коментар про гостя"
              style={{
                top: popoverPos.top,
                left: popoverPos.left,
                width: popoverPos.width,
              }}
            >
              {noteEditor}
            </div>,
            document.body
          )
        : null}

      {noteOpen && isMobile && typeof document !== "undefined"
        ? createPortal(
            <div className="guest-rep-sheet" role="presentation">
              <button
                type="button"
                className="guest-rep-sheet__backdrop"
                aria-label="Закрити"
                onClick={closeNote}
              />
              <div className="guest-rep-sheet__panel" role="dialog" aria-label="Коментар про гостя">
                <div className="guest-rep-sheet__handle" aria-hidden />
                {noteEditor}
              </div>
            </div>,
            document.body
          )
        : null}
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
    <span
      className={`guest-badge${meta ? ` guest-badge--${meta.tone}` : ""}`}
      title={note || meta?.label || ""}
    >
      {meta ? <GuestFaceIcon rating={rating!} size={16} /> : null}
      {hasNote ? (
        <span className="guest-badge__note-icon">
          <GuestCommentIcon size={13} />
        </span>
      ) : null}
    </span>
  );
}
