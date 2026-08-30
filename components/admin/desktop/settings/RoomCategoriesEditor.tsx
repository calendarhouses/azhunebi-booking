"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

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

  const startEdit = (cat: RoomCategory) => {
    setEditingId(cat.id);
    setEditValue(cat.name);
  };

  const commitEdit = (id: string) => {
    const current = categories.find((c) => c.id === id);
    const trimmed = editValue.trim();
    setEditingId(null);
    if (!trimmed || !current || trimmed === current.name) return;
    rename(id, trimmed);
  };

  const cancelEdit = () => setEditingId(null);

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
            <CategoryRow
              key={cat.id}
              cat={cat}
              index={index}
              total={categories.length}
              roomsCount={roomsByCat(cat.id)}
              editing={editingId === cat.id}
              editValue={editValue}
              onEditValue={setEditValue}
              onStartEdit={() => startEdit(cat)}
              onCommitEdit={() => commitEdit(cat.id)}
              onCancelEdit={cancelEdit}
              onMove={move}
              onToggleHidden={() => toggleHidden(cat.id)}
              onRemove={() => remove(cat)}
            />
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

function CategoryRow({
  cat,
  index,
  total,
  roomsCount,
  editing,
  editValue,
  onEditValue,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onMove,
  onToggleHidden,
  onRemove,
}: {
  cat: RoomCategory;
  index: number;
  total: number;
  roomsCount: number;
  editing: boolean;
  editValue: string;
  onEditValue: (value: string) => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onToggleHidden: () => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const skipCommitRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  return (
    <li className={`room-cats__row${cat.hidden ? " is-hidden" : ""}${editing ? " is-editing" : ""}`}>
      {editing ? (
        <input
          ref={inputRef}
          className="room-cats__name-input"
          value={editValue}
          aria-label="Назва категорії"
          onChange={(e) => onEditValue(e.target.value)}
          onBlur={() => {
            if (skipCommitRef.current) {
              skipCommitRef.current = false;
              onCancelEdit();
              return;
            }
            onCommitEdit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              skipCommitRef.current = true;
              e.currentTarget.blur();
            }
          }}
        />
      ) : (
        <span className="room-cats__name">{cat.name}</span>
      )}
      <span className="room-cats__count">
        {roomsCount} {houseWord(roomsCount)}
      </span>
      <div className="room-cats__actions">
        <button
          type="button"
          className={`room-cats__icon-btn${editing ? " is-active" : ""}`}
          onMouseDown={(e) => {
            if (editing) e.preventDefault();
          }}
          onClick={() => {
            if (editing) onCommitEdit();
            else onStartEdit();
          }}
          aria-label="Редагувати назву"
          title="Редагувати назву"
        >
          <Pencil className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="room-cats__icon-btn"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          aria-label="Вище"
        >
          <ChevronUp className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="room-cats__icon-btn"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          aria-label="Нижче"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2} />
        </button>
        <button
          type="button"
          className="room-cats__icon-btn"
          onClick={onToggleHidden}
          aria-label={cat.hidden ? "Показати категорію і житло" : "Сховати категорію і житло"}
          title={cat.hidden ? "Прихована: немає на сайті і шахматі" : "Видима на сайті і шахматі"}
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
          onClick={onRemove}
          aria-label="Видалити"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </li>
  );
}
