"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload, RoomCategory } from "../types";
import {
  houseWord,
  newRoomCategoryId,
  normalizeRoomCategories,
} from "@/lib/admin/roomCategories";
import "./room-categories.css";

type Props = {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
};

export function RoomCategoriesEditor({ settings, modals }: Props) {
  const categories = normalizeRoomCategories(settings.roomCategoriesList);
  const [draftName, setDraftName] = useState("");

  const persist = useCallback(
    async (next: RoomCategory[], clearFromRooms?: string) => {
      await modals.saveRoomCategoriesList(next, clearFromRooms);
    },
    [modals]
  );

  const addCategory = () => {
    const name = draftName.trim();
    if (!name) return;
    void persist([
      ...categories,
      { id: newRoomCategoryId(), name, sort: categories.length },
    ]);
    setDraftName("");
  };

  const rename = (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    void persist(categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...categories];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void persist(next);
  };

  const toggleHidden = (id: string) => {
    void persist(categories.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)));
  };

  const remove = (cat: RoomCategory) => {
    modals.openCustomConfirm(
      `Видалити «${cat.name}»?`,
      "Категорія зникне з сайту. Житло лишиться, просто без категорії.",
      () => void persist(
        categories.filter((c) => c.id !== cat.id),
        cat.id
      )
    );
  };

  const roomsByCat = (id: string) =>
    (settings.roomsList || []).filter((r) => r.categoryId === id).length;

  return (
    <section className="room-cats">
      <header className="room-cats__head">
        <h3 className="room-cats__title">Категорії житла</h3>
      </header>

      {categories.length ? (
        <ul className="room-cats__list">
          {categories.map((cat, index) => (
            <li key={cat.id} className={`room-cats__row${cat.hidden ? " is-hidden" : ""}`}>
              <input
                className="room-cats__name"
                defaultValue={cat.name}
                aria-label="Назва категорії"
                onBlur={(e) => {
                  if (e.target.value.trim() !== cat.name) rename(cat.id, e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
              <span className="room-cats__count">
                {roomsByCat(cat.id)} {houseWord(roomsByCat(cat.id))}
              </span>
              <div className="room-cats__actions">
                <button
                  type="button"
                  className="room-cats__icon-btn"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Вище"
                >
                  <ChevronUp className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="room-cats__icon-btn"
                  disabled={index === categories.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Нижче"
                >
                  <ChevronDown className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="room-cats__icon-btn"
                  onClick={() => toggleHidden(cat.id)}
                  aria-label={cat.hidden ? "Показати на сайті" : "Сховати на сайті"}
                  title={cat.hidden ? "Прихована на сайті" : "Видима на сайті"}
                >
                  {cat.hidden ? (
                    <EyeOff className="h-4 w-4" strokeWidth={2} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
                <button
                  type="button"
                  className="room-cats__icon-btn room-cats__icon-btn--danger"
                  onClick={() => remove(cat)}
                  aria-label="Видалити"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="room-cats__empty">Поки немає категорій — усі будинки в одному списку.</p>
      )}

      <div className="room-cats__add">
        <input
          className="room-cats__add-input"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Напр. Глемпи"
          onKeyDown={(e) => {
            if (e.key === "Enter") addCategory();
          }}
        />
        <button type="button" className="room-cats__add-btn" onClick={addCategory} disabled={!draftName.trim()}>
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Додати
        </button>
      </div>
    </section>
  );
}
