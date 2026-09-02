"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Clock3, ShieldCheck } from "lucide-react";
import { showToast } from "../adminGlobals";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload } from "../types";
import {
  buildHourlyTimeRange,
  resolveFlexibleScheduleSettings,
  validateFlexibleScheduleWindows,
  percentOfDayFromDisplay,
  percentOfDayToDisplay,
  type FlexibleScheduleSettings,
} from "@/lib/admin/flexibleSchedule";
import { TimeSelectField } from "./TimeSelectField";

type Props = {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
};

function formatFeeSummary(form: FlexibleScheduleSettings): string {
  if (form.pricingMode === "fixed") {
    return `${form.earlyFee.toLocaleString("uk-UA")} / ${form.lateFee.toLocaleString("uk-UA")} ₴`;
  }
  return `${percentOfDayToDisplay(form.percentOfDay)}% від ціни дня`;
}

function formatWindowSummary(form: FlexibleScheduleSettings): string {
  return `РЗ ${form.earlyWindowStart}–${form.earlyWindowEnd} · ПВ ${form.lateWindowStart}–${form.lateWindowEnd}`;
}

function mergeFlexibleForm(settings: AdminSettingsPayload): FlexibleScheduleSettings {
  return resolveFlexibleScheduleSettings(settings);
}

export function FlexibleScheduleSettingsPanel({ settings, modals }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FlexibleScheduleSettings>(() => mergeFlexibleForm(settings));
  const [saving, setSaving] = useState(false);
  const hadServerFlexRef = useRef(settings.flexibleScheduleSettings != null);

  // Sync from server when closed; also adopt first server payload even if accordion is open
  // (avoids saving DEFAULT 1000 over a real 1500 that arrived late).
  useEffect(() => {
    const hasServer = settings.flexibleScheduleSettings != null;
    const firstServerArrival = hasServer && !hadServerFlexRef.current;
    if (hasServer) hadServerFlexRef.current = true;
    if (open && !firstServerArrival) return;
    setForm(mergeFlexibleForm(settings));
  }, [settings.flexibleScheduleSettings, open, settings]);

  const feeSummary = useMemo(() => formatFeeSummary(form), [form]);
  const percentDisplay = percentOfDayToDisplay(form.percentOfDay);

  const toggleOpen = () => {
    if (!open) {
      setForm(mergeFlexibleForm(settings));
    }
    setOpen((value) => !value);
  };

  const save = useCallback(async () => {
    const validation = validateFlexibleScheduleWindows(form);
    if (!validation.ok) {
      showToast(validation.message);
      return;
    }
    setSaving(true);
    try {
      const earlyTimes = buildHourlyTimeRange(form.earlyWindowStart, form.earlyWindowEnd);
      const lateTimes = buildHourlyTimeRange(form.lateWindowStart, form.lateWindowEnd);
      const payload: FlexibleScheduleSettings = {
        ...form,
        earlyTimes: earlyTimes.length ? earlyTimes : form.earlyTimes,
        lateTimes: lateTimes.length ? lateTimes : form.lateTimes,
      };
      await modals.persistSettings(
        { ...settings, flexibleScheduleSettings: payload },
        { keys: ["flexibleScheduleSettings"] }
      );
      showToast("Гнучкий графік збережено");
      setOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Не вдалося зберегти графік");
    } finally {
      setSaving(false);
    }
  }, [form, modals, settings]);

  return (
    <section className={`svc-accordion${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="svc-accordion__trigger"
        aria-expanded={open}
        aria-controls="flexible-schedule-settings-panel"
        onClick={toggleOpen}
      >
        <div className="svc-accordion__trigger-main">
          <span className="svc-accordion__icon" aria-hidden>
            <Clock3 size={18} />
          </span>
          <div className="svc-accordion__trigger-text">
            <span className="svc-accordion__label">Гнучкий графік</span>
            <span className="svc-accordion__hint">
              Заїзд {form.standardCheckIn} · Виїзд {form.standardCheckOut} · {formatWindowSummary(form)} ·{" "}
              {feeSummary}
              {form.requiresApproval ? " · Запит адміна" : ""}
            </span>
          </div>
        </div>
        <ChevronDown size={18} className="svc-accordion__chevron" aria-hidden />
      </button>

      <div
        id="flexible-schedule-settings-panel"
        className="svc-accordion__collapse"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="svc-accordion__panel">
          <p className="svc-accordion__intro">
            Ранній заїзд і пізній виїзд на сайті. Гість бачить стандартний час і може подати запит.
          </p>

          <div className="svc-accordion__section">
            <div className="svc-form-grid svc-form-grid--2">
              <TimeSelectField
                label="Стандартний заїзд"
                value={form.standardCheckIn}
                onChange={(standardCheckIn) => setForm((f) => ({ ...f, standardCheckIn }))}
              />
              <TimeSelectField
                label="Стандартний виїзд"
                value={form.standardCheckOut}
                onChange={(standardCheckOut) => setForm((f) => ({ ...f, standardCheckOut }))}
              />
            </div>
          </div>

          <div className="svc-accordion__section">
            <div className="svc-form-grid svc-form-grid--2">
              <TimeSelectField
                label="Ранній заїзд — від"
                value={form.earlyWindowStart}
                onChange={(earlyWindowStart) => setForm((f) => ({ ...f, earlyWindowStart }))}
              />
              <TimeSelectField
                label="Ранній заїзд — до"
                value={form.earlyWindowEnd}
                onChange={(earlyWindowEnd) => setForm((f) => ({ ...f, earlyWindowEnd }))}
              />
            </div>
            <span className="svc-field__caption" style={{ marginTop: 8 }}>
              Години на сайті та в броні:{" "}
              {buildHourlyTimeRange(form.earlyWindowStart, form.earlyWindowEnd).join(", ") ||
                "— некоректне вікно"}
            </span>
          </div>

          <div className="svc-accordion__section">
            <div className="svc-form-grid svc-form-grid--2">
              <TimeSelectField
                label="Пізній виїзд — від"
                value={form.lateWindowStart}
                onChange={(lateWindowStart) => setForm((f) => ({ ...f, lateWindowStart }))}
              />
              <TimeSelectField
                label="Пізній виїзд — до"
                value={form.lateWindowEnd}
                onChange={(lateWindowEnd) => setForm((f) => ({ ...f, lateWindowEnd }))}
              />
            </div>
            <span className="svc-field__caption" style={{ marginTop: 8 }}>
              Години на сайті та в броні:{" "}
              {buildHourlyTimeRange(form.lateWindowStart, form.lateWindowEnd).join(", ") ||
                "— некоректне вікно"}
            </span>
          </div>

          <div className="svc-accordion__section">
            <div className="svc-field">
              <span className="svc-field__label">Тип нарахування</span>
              <div className="svc-segmented">
                <button
                  type="button"
                  className={`svc-segmented__btn${form.pricingMode === "fixed" ? " is-active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, pricingMode: "fixed" }))}
                >
                  Фіксована сума
                </button>
                <button
                  type="button"
                  className={`svc-segmented__btn${form.pricingMode === "percent_of_day" ? " is-active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, pricingMode: "percent_of_day" }))}
                >
                  % від ціни дня
                </button>
              </div>
            </div>
          </div>

          <div className="svc-accordion__section">
            {form.pricingMode === "fixed" ? (
              <div className="svc-form-grid svc-form-grid--2">
                <label className="svc-field">
                  <span className="svc-field__label">Ранній заїзд</span>
                  <div className="svc-field__suffix-wrap">
                    <input
                      className="svc-field__input"
                      type="number"
                      min={0}
                      value={form.earlyFee}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, earlyFee: Math.max(0, Number(e.target.value) || 0) }))
                      }
                    />
                    <span className="svc-field__suffix">₴</span>
                  </div>
                </label>
                <label className="svc-field">
                  <span className="svc-field__label">Пізній виїзд</span>
                  <div className="svc-field__suffix-wrap">
                    <input
                      className="svc-field__input"
                      type="number"
                      min={0}
                      value={form.lateFee}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lateFee: Math.max(0, Number(e.target.value) || 0) }))
                      }
                    />
                    <span className="svc-field__suffix">₴</span>
                  </div>
                </label>
              </div>
            ) : (
              <label className="svc-field">
                <span className="svc-field__label">Відсоток від ціни дня</span>
                <div className="svc-field__suffix-wrap">
                  <input
                    className="svc-field__input"
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={percentDisplay}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        percentOfDay: percentOfDayFromDisplay(Number(e.target.value) || 0),
                      }))
                    }
                  />
                  <span className="svc-field__suffix">%</span>
                </div>
                <span className="svc-field__caption">
                  Застосовується до ціни дня заїзду та виїзду
                </span>
              </label>
            )}
          </div>

          <div className="svc-accordion__section">
            <button
              type="button"
              className={`svc-option-card${form.requiresApproval ? " is-active" : ""}`}
              onClick={() => setForm((f) => ({ ...f, requiresApproval: !f.requiresApproval }))}
            >
              <span className="svc-option-card__icon svc-option-card__icon--amber">
                <ShieldCheck size={18} />
              </span>
              <span className="svc-option-card__body">
                <strong>Підтвердження адміністратором</strong>
                <small>На сайті сума в чеку; при схваленні — в оплату</small>
              </span>
              <span className={`svc-switch${form.requiresApproval ? " is-on" : ""}`} aria-hidden>
                <span />
              </span>
            </button>
          </div>

          <div className="svc-accordion__footer">
            <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Збереження…" : "Зберегти графік"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
