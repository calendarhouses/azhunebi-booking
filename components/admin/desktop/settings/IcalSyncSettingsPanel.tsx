"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarSync, Check, Copy, RefreshCw } from "lucide-react";
import { showToast } from "../adminGlobals";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload, RoomConfig } from "../types";
import {
  buildIcalExportUrl,
  generateIcalExportSecret,
  getPublicIcalOrigin,
  normalizeIcalSyncSettings,
  type IcalSyncSettings,
} from "@/lib/ical";
import "./settings-ical.css";

type Props = {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
};

function formatSyncTime(iso?: string): string {
  if (!iso) return "ще не синхронізовано";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IcalSyncSettingsPanel({ settings, modals }: Props) {
  const rooms = useMemo(
    () => (Array.isArray(settings.roomsList) ? settings.roomsList : []) as RoomConfig[],
    [settings.roomsList]
  );

  const [form, setForm] = useState<IcalSyncSettings>(() =>
    normalizeIcalSyncSettings(settings.icalSyncSettings, rooms.map((r) => r.id))
  );
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setForm(normalizeIcalSyncSettings(settings.icalSyncSettings, rooms.map((r) => r.id)));
  }, [settings.icalSyncSettings, rooms]);

  const origin = useMemo(() => getPublicIcalOrigin(), []);

  const ensureSecret = useCallback((current: IcalSyncSettings): IcalSyncSettings => {
    if (current.exportSecret) return current;
    return { ...current, exportSecret: generateIcalExportSecret() };
  }, []);

  const setImportUrl = (roomId: number, importUrl: string) => {
    setForm((prev) => ({
      ...prev,
      rooms: prev.rooms.map((r) =>
        r.roomId === roomId ? { ...r, importUrl: importUrl.trim() || undefined } : r
      ),
    }));
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      showToast("Скопійовано");
      window.setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      showToast("Не вдалося скопіювати");
    }
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const next = ensureSecret(
        normalizeIcalSyncSettings(form, rooms.map((r) => r.id))
      );
      await modals.persistSettings(
        { ...settings, icalSyncSettings: next },
        { keys: ["icalSyncSettings"] }
      );
      setForm(next);
      showToast("iCal налаштування збережено");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  }, [ensureSecret, form, modals, rooms, settings]);

  const rotateSecret = () => {
    if (
      !window.confirm(
        "Змінити секрет експорту? Старі посилання в Booking.com перестануть працювати — їх треба буде оновити."
      )
    ) {
      return;
    }
    setForm((prev) => ({ ...prev, exportSecret: generateIcalExportSecret() }));
  };

  const connectedCount = form.rooms.filter((r) => r.importUrl).length;

  return (
    <section className="ical-sync-panel">
      <header className="ical-sync-panel__header">
        <div className="ical-sync-panel__title-row">
          <span className="ical-sync-panel__icon" aria-hidden>
            <CalendarSync size={20} />
          </span>
          <div>
            <h3 className="ical-sync-panel__title">Синхронізація календарів (iCal)</h3>
            <p className="ical-sync-panel__lead">
              Двосторонній обмін зайнятими датами з Booking.com. Підключено імпорт:{" "}
              {connectedCount} з {rooms.length}.
            </p>
          </div>
        </div>
        <div className="ical-sync-panel__actions">
          <button type="button" className="btn-secondary tap-btn" onClick={rotateSecret}>
            <RefreshCw size={15} aria-hidden />
            Новий секрет
          </button>
          <button
            type="button"
            className="btn-primary tap-btn"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Збереження…" : "Зберегти"}
          </button>
        </div>
      </header>

      <ol className="ical-sync-steps">
        <li>
          Спочатку <strong>відключіть Aiosell / BookMeNow</strong> у Booking.com (Провайдер з
          підключення), інакше пункту «Синхронізувати календарі» не буде.
        </li>
        <li>
          У Booking для кожного будиночка: <strong>імпортуйте</strong> наше посилання (щоб
          Booking закривав дати з нашої шахматки).
        </li>
        <li>
          Скопіюйте з Booking їхнє <strong>експорт-посилання</strong> і вставте нижче (щоб броні з
          Booking з’являлись у нас як «Закрито»).
        </li>
      </ol>

      {!rooms.length ? (
        <p className="ical-sync-empty">Спочатку додайте житло у вкладці «Моє житло».</p>
      ) : (
        <div className="ical-sync-list">
          {rooms.map((room) => {
            const row = form.rooms.find((r) => r.roomId === Number(room.id));
            const exportUrl =
              form.exportSecret
                ? buildIcalExportUrl({
                    origin,
                    roomId: room.id,
                    exportSecret: form.exportSecret,
                  })
                : "";
            const label = room.short || room.name || `Будинок ${room.id}`;
            return (
              <article key={room.id} className="ical-sync-card">
                <div className="ical-sync-card__head">
                  <h4>{label}</h4>
                  <span className="ical-sync-card__meta">
                    {row?.lastError
                      ? `Помилка: ${row.lastError}`
                      : `Оновлено: ${formatSyncTime(row?.lastSyncedAt)}`}
                  </span>
                </div>

                <label className="ical-sync-field">
                  <span>Наше посилання → вставте в Booking як імпорт календаря</span>
                  <div className="ical-sync-field__row">
                    <input
                      type="text"
                      readOnly
                      value={exportUrl || "Збережіть налаштування, щоб згенерувати посилання"}
                    />
                    <button
                      type="button"
                      className="btn-secondary tap-btn"
                      disabled={!exportUrl}
                      onClick={() => exportUrl && copyText(`export-${room.id}`, exportUrl)}
                      aria-label="Копіювати експорт-посилання"
                    >
                      {copiedKey === `export-${room.id}` ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  </div>
                </label>

                <label className="ical-sync-field">
                  <span>Посилання з Booking → вставте сюди (експорт їхнього календаря)</span>
                  <input
                    type="url"
                    placeholder="https://admin.booking.com/hotel/hoteladmin/ical.html?..."
                    value={row?.importUrl || ""}
                    onChange={(e) => setImportUrl(Number(room.id), e.target.value)}
                  />
                </label>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
