"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, Clock, Hash, Moon, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { RoomSidebarHouseIcon } from "@/components/ui/icons/RoomSidebarHouseIcon";
import { adminRoomLabel } from "@/lib/admin/roomDisplay";
import type { ServiceFormState } from "./additionalServicesLogic";
import { previewServiceFee } from "./additionalServicesLogic";
import type { AdminSettingsPayload } from "../types";

const PRICING_MULTIPLIERS = [
  { key: "perBooking" as const, label: "За бронь", hint: "базова", Icon: Hash },
  { key: "perDay" as const, label: "За ніч", hint: "× ночі", Icon: Moon },
  { key: "perGuest" as const, label: "За гостя", hint: "× гості", Icon: Users },
  { key: "perHour" as const, label: "За годину", hint: "× години", Icon: Clock },
];

type Props = {
  open: boolean;
  saving?: boolean;
  title: string;
  settings: AdminSettingsPayload;
  form: ServiceFormState;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onChange: (updater: (prev: ServiceFormState) => ServiceFormState) => void;
};

export function ServiceEditorDrawer({
  open,
  saving = false,
  title,
  settings,
  form,
  onClose,
  onSave,
  onChange,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const rooms = settings.roomsList || [];
  const previewAmount = previewServiceFee(form, { nights: 3, adults: 2, children: 0, quantity: 1 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const toggleRoom = (roomId: number) => {
    onChange((prev) => {
      const has = prev.roomIds.includes(roomId);
      return {
        ...prev,
        roomIds: has ? prev.roomIds.filter((id) => id !== roomId) : [...prev.roomIds, roomId],
      };
    });
  };

  const previewText = form.onSite
    ? "Оплата на місці"
    : form.requiresApproval
      ? "Запит без суми"
      : `${previewAmount.toLocaleString("uk-UA")} ₴`;

  return createPortal(
    <div className="admin-side-drawer-overlay active" onClick={onClose}>
      <div
        className="admin-side-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="serviceEditorTitle"
      >
        <div className="admin-side-drawer__header">
          <div>
            <p className="admin-side-drawer__eyebrow">Послуга для гостей</p>
            <h2 id="serviceEditorTitle">{title}</h2>
          </div>
          <button type="button" className="admin-side-drawer__close" onClick={onClose} aria-label="Закрити">
            <X size={18} />
          </button>
        </div>

        <div className="admin-side-drawer__body">
          <div className="svc-drawer-block">
            <h3 className="svc-drawer-block__title">
              <Sparkles size={15} />
              Основне
            </h3>
            <div className="svc-form-grid svc-form-grid--2">
              <label className="svc-field svc-field--span-2">
                <span className="svc-field__label">Назва послуги</span>
                <input
                  className="svc-field__input"
                  type="text"
                  value={form.name}
                  placeholder="Наприклад, Чан"
                  onChange={(e) => onChange((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="svc-field">
                <span className="svc-field__label">Ціна</span>
                <div className="svc-field__suffix-wrap">
                  <input
                    className="svc-field__input"
                    type="number"
                    min={0}
                    value={form.price}
                    placeholder="0"
                    onChange={(e) => onChange((prev) => ({ ...prev, price: e.target.value }))}
                  />
                  <span className="svc-field__suffix">₴</span>
                </div>
              </label>
              <label className="svc-field">
                <span className="svc-field__label">Статус</span>
                <button
                  type="button"
                  className={`svc-status-pill${form.active ? " is-on" : ""}`}
                  onClick={() => onChange((prev) => ({ ...prev, active: !prev.active }))}
                >
                  <span className={`svc-switch svc-switch--sm${form.active ? " is-on" : ""}`} aria-hidden>
                    <span />
                  </span>
                  {form.active ? "Увімкнена" : "Вимкнена"}
                </button>
              </label>
              <label className="svc-field svc-field--span-2">
                <span className="svc-field__label">Опис для гостя</span>
                <textarea
                  className="svc-field__textarea"
                  rows={2}
                  value={form.description}
                  placeholder="Коротка підказка на сайті та в броні"
                  onChange={(e) => onChange((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
            </div>
          </div>

          <div className="svc-drawer-block">
            <h3 className="svc-drawer-block__title">Тип нарахування</h3>
            <p className="svc-drawer-block__caption">
              {form.perHour
                ? "Ціна множиться на кількість годин — гість обирає лічильником"
                : !form.perBooking && !form.perDay && !form.perGuest
                  ? "Обери хоча б один тип — за замовчуванням буде «За бронь»"
                  : "Можна ввімкнути кілька — ціна множиться на обрані параметри"}
            </p>
            <div className="svc-pricing-grid">
              {PRICING_MULTIPLIERS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`svc-pricing-card${form[option.key] ? " is-active" : ""}`}
                  onClick={() =>
                    onChange((prev) => {
                      const nextVal = !prev[option.key];
                      if (option.key === "perHour" && nextVal) {
                        return {
                          ...prev,
                          perHour: true,
                          perBooking: false,
                          perDay: false,
                          perGuest: false,
                          inputType: "counter",
                        };
                      }
                      if (option.key !== "perHour" && nextVal) {
                        return { ...prev, [option.key]: true, perHour: false };
                      }
                      return { ...prev, [option.key]: nextVal };
                    })
                  }
                >
                  <span className="svc-pricing-card__icon">
                    <option.Icon size={16} />
                  </span>
                  <span className="svc-pricing-card__text">
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="svc-drawer-block">
            <h3 className="svc-drawer-block__title">Поведінка</h3>
            <div className="svc-options-stack">
              <button
                type="button"
                className={`svc-option-card${form.onSite ? " is-active" : ""}`}
                onClick={() => onChange((prev) => ({ ...prev, onSite: !prev.onSite }))}
              >
                <span className="svc-option-card__icon svc-option-card__icon--stone">
                  <Banknote size={18} />
                </span>
                <span className="svc-option-card__body">
                  <strong>Оплата на місці</strong>
                  <small>Не входить у онлайн-розрахунок</small>
                </span>
                <span className={`svc-switch svc-switch--sm${form.onSite ? " is-on" : ""}`} aria-hidden>
                  <span />
                </span>
              </button>
              <button
                type="button"
                className={`svc-option-card${form.requiresApproval ? " is-active" : ""}`}
                onClick={() =>
                  onChange((prev) => ({ ...prev, requiresApproval: !prev.requiresApproval }))
                }
              >
                <span className="svc-option-card__icon svc-option-card__icon--amber">
                  <ShieldCheck size={18} />
                </span>
                <span className="svc-option-card__body">
                  <strong>Підтвердження адміністратором</strong>
                  <small>На сайті — запит без суми в оплаті</small>
                </span>
                <span
                  className={`svc-switch svc-switch--sm${form.requiresApproval ? " is-on" : ""}`}
                  aria-hidden
                >
                  <span />
                </span>
              </button>
            </div>

            <div className="svc-field">
              <span className="svc-field__label">Як гість обирає</span>
              <div className="svc-segmented">
                <button
                  type="button"
                  className={`svc-segmented__btn${form.inputType === "toggle" ? " is-active" : ""}`}
                  onClick={() => onChange((prev) => ({ ...prev, inputType: "toggle" }))}
                >
                  Так / Ні
                </button>
                <button
                  type="button"
                  className={`svc-segmented__btn${form.inputType === "counter" ? " is-active" : ""}`}
                  onClick={() => onChange((prev) => ({ ...prev, inputType: "counter" }))}
                >
                  Лічильник
                </button>
              </div>
            </div>

            {form.inputType === "counter" ? (
              <label className="svc-field">
                <span className="svc-field__label">Максимум, шт.</span>
                <input
                  className="svc-field__input"
                  type="number"
                  min={1}
                  max={99}
                  value={form.maxQuantity}
                  onChange={(e) =>
                    onChange((prev) => ({
                      ...prev,
                      maxQuantity: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                />
              </label>
            ) : null}
          </div>

          <div className="svc-drawer-block">
            <h3 className="svc-drawer-block__title">Будинки</h3>
            <p className="svc-drawer-block__caption">
              Якщо нічого не обрано — послуга доступна для всіх будинків.
            </p>
            <div className="svc-rooms-grid">
              {rooms.map((room) => {
                const active = form.roomIds.includes(room.id);
                return (
                  <button
                    key={room.id}
                    type="button"
                    className={`svc-room-chip${active ? " is-active" : ""}`}
                    onClick={() => toggleRoom(room.id)}
                  >
                    <RoomSidebarHouseIcon className="svc-room-chip__icon" />
                    {adminRoomLabel(room)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="svc-drawer-preview">
            <div className="svc-drawer-preview__text">
              <span className="svc-drawer-preview__label">Сума для гостя</span>
              <span className="svc-drawer-preview__hint">3 ночі · 2 дорослих · 1 послуга</span>
            </div>
            <strong>{previewText}</strong>
          </div>
        </div>

        <div className="admin-side-drawer__footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void onSave()}>
            {saving ? "Збереження…" : "Зберегти"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
