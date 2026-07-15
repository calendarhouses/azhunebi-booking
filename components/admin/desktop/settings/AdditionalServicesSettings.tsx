"use client";

import { useCallback, useMemo, useState } from "react";
import { Banknote, Clock, Hash, Moon, Pencil, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { showToast } from "../adminGlobals";
import type { AdminModalsApi } from "../useAdminModals";
import type { AdminSettingsPayload, CustomServiceConfig } from "../types";
import {
  applyServiceFormToSettings,
  buildServiceForm,
  defaultServiceFormState,
  formatServicePriceHint,
  pricingLabelsFromService,
  roomsLabelForService,
  type ServiceFormState,
} from "./additionalServicesLogic";
import { ServiceEditorDrawer } from "./ServiceEditorDrawer";
import { SERVICE_TEMPLATES } from "./serviceTemplates";

type Props = {
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
};

function pricingIcon(service: CustomServiceConfig) {
  const perDay = service.perDay === "Так";
  const perGuest = service.perGuest === "Так";
  if (perGuest) return Users;
  if (perDay) return Moon;
  return Hash;
}

export function AdditionalServicesSettings({ settings, modals }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceFormState>(defaultServiceFormState());
  const [saving, setSaving] = useState(false);

  const services = settings.customServicesList || [];
  const roomsList = settings.roomsList || [];

  const sortedServices = useMemo(
    () => [...services].sort((a, b) => String(a.name).localeCompare(String(b.name), "uk")),
    [services]
  );

  const openCreate = useCallback(() => {
    setEditId(null);
    setForm(defaultServiceFormState());
    setDrawerOpen(true);
  }, []);

  const openFromTemplate = useCallback((templateId: string) => {
    const template = SERVICE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    setEditId(null);
    setForm({ ...defaultServiceFormState(), ...template.form });
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((service: CustomServiceConfig) => {
    setEditId(service.id);
    setForm(buildServiceForm(service));
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    if (saving) return;
    setDrawerOpen(false);
  }, [saving]);

  const saveService = useCallback(async () => {
    const patch = applyServiceFormToSettings(settings, form, editId);
    if (!patch) {
      showToast("Вкажи назву послуги");
      return;
    }
    setSaving(true);
    try {
      await modals.persistSettings(
        { ...settings, ...patch },
        { keys: ["customServicesList"], background: true }
      );
      setDrawerOpen(false);
      showToast(editId != null ? "Послугу оновлено" : "Послугу додано");
    } finally {
      setSaving(false);
    }
  }, [editId, form, modals, settings]);

  const deleteService = useCallback(
    async (serviceId: number) => {
      const next = {
        ...settings,
        customServicesList: (settings.customServicesList || []).filter((s) => s.id !== serviceId),
      };
      await modals.persistSettings(next, { keys: ["customServicesList"], background: true });
      showToast("Послугу видалено");
    },
    [modals, settings]
  );

  const toggleActive = useCallback(
    async (service: CustomServiceConfig) => {
      const list = (settings.customServicesList || []).map((item) =>
        item.id === service.id ? { ...item, active: !item.active } : item
      );
      await modals.persistSettings(
        { ...settings, customServicesList: list },
        { keys: ["customServicesList"], background: true }
      );
    },
    [modals, settings]
  );

  return (
    <>
      <section className="svc-catalog">
        <div className="svc-catalog__toolbar">
          <div>
            <h2 className="svc-catalog__title">Каталог послуг</h2>
            <p className="svc-catalog__caption">
              Чан, трансфер, прокат — гість обере при бронюванні, ти побачиш у деталях броні.
            </p>
          </div>
          <button type="button" className="btn-primary svc-catalog__add" onClick={openCreate}>
            <Plus size={17} />
            Додати послугу
          </button>
        </div>

        <div className="svc-templates">
          <span className="svc-templates__label">Швидкі шаблони</span>
          <div className="svc-templates__row">
            {SERVICE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className="svc-template-chip"
                onClick={() => openFromTemplate(template.id)}
              >
                <Plus size={14} aria-hidden />
                {template.label}
              </button>
            ))}
          </div>
        </div>

        {sortedServices.length === 0 ? (
          <div className="svc-empty">
            <div className="svc-empty__icon" aria-hidden>
              <Sparkles size={26} />
            </div>
            <h3>Поки немає послуг</h3>
            <p>Обери шаблон вище або створи власну послугу з ціною та будинками.</p>
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={17} />
              Додати послугу
            </button>
          </div>
        ) : (
          <div className="svc-grid">
            {sortedServices.map((service) => {
              const PriceIcon = pricingIcon(service);
              return (
                <article
                  key={service.id}
                  className={`svc-card${service.active ? "" : " is-off"}`}
                >
                  <div className="svc-card__top">
                    <div className="svc-card__info">
                      <h3 className="svc-card__name">{service.name}</h3>
                      <p className="svc-card__price">{formatServicePriceHint(service)}</p>
                    </div>
                    <button
                      type="button"
                      className={`svc-switch${service.active ? " is-on" : ""}`}
                      onClick={() => void toggleActive(service)}
                      aria-pressed={service.active}
                      aria-label={service.active ? "Вимкнути послугу" : "Увімкнути послугу"}
                    >
                      <span />
                    </button>
                  </div>

                  {service.description ? (
                    <p className="svc-card__desc">{service.description}</p>
                  ) : null}

                  <div className="svc-card__tags">
                    {pricingLabelsFromService(service).map((label) => (
                      <span key={label} className="svc-tag svc-tag--accent">
                        <PriceIcon size={12} aria-hidden />
                        {label}
                      </span>
                    ))}
                    <span className="svc-tag">
                      {roomsLabelForService(service.roomIds || [], roomsList) ||
                        service.rooms ||
                        "Всі будинки"}
                    </span>
                    {service.onSite ? (
                      <span className="svc-tag svc-tag--muted">
                        <Banknote size={12} aria-hidden />
                        На місці
                      </span>
                    ) : null}
                    {service.requiresApproval ? (
                      <span className="svc-tag svc-tag--amber">
                        <Clock size={12} aria-hidden />
                        Запит
                      </span>
                    ) : null}
                    {service.inputType === "counter" ? (
                      <span className="svc-tag svc-tag--muted">Лічильник</span>
                    ) : null}
                  </div>

                  <div className="svc-card__actions">
                    <button type="button" className="svc-card__edit" onClick={() => openEdit(service)}>
                      <Pencil size={15} aria-hidden />
                      Редагувати
                    </button>
                    <button
                      type="button"
                      className="svc-card__delete"
                      onClick={() => void deleteService(service.id)}
                      aria-label="Видалити послугу"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ServiceEditorDrawer
        open={drawerOpen}
        saving={saving}
        title={editId != null ? "Редагувати послугу" : "Нова послуга"}
        settings={settings}
        form={form}
        onClose={closeDrawer}
        onSave={saveService}
        onChange={setForm}
      />
    </>
  );
}
