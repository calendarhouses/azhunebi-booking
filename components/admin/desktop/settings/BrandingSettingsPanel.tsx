"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Banknote, ChevronDown, ImagePlus, Moon, Percent, Wallet } from "lucide-react";
import { saveAdminSettings, getAdminTenantId } from "../adminApi";
import { showToast } from "../adminGlobals";
import type { AdminSettingsPayload } from "../types";
import type { PublicBranding } from "@/lib/public-booking/types";
import {
  formatPrepaymentGuestLabel,
  readPrepaymentPolicy,
  type PrepaymentMode,
} from "@/lib/public-booking/prepaymentPolicy";
import { dobaWord } from "@/components/admin/desktop/adminPlural";
import { GuestPhoneField } from "@/components/admin/onboarding/GuestPhoneField";
import {
  formatGuestPhoneForSave,
  isValidGuestPhone,
  parseStoredGuestPhone,
} from "@/lib/admin/onboarding/uaPhone";
import {
  COMPRESS_FAIL_MESSAGE,
  compressImageForUpload,
} from "@/lib/admin/onboarding/mediaCompression";
import { uploadTenantLogo } from "@/utils/tenantLogoStorage";
import { normalizeDriveImageUrl, toImageDisplaySrc } from "@/lib/driveImageUrl";
import { resolveGoogleMapsEmbedUrl } from "@/lib/googleMapsUrl";
import { setCachedTenantLogoUrl } from "@/lib/admin/brandingLogoCache";
import { applyAdminDocumentTitle } from "@/lib/admin/adminDocumentTitle";
import "../settings/settings-additional-services.css";

const PREPAYMENT_MODES = [
  { mode: "percent" as const, label: "Відсоток", hint: "від суми броні", Icon: Percent },
  { mode: "nights" as const, label: "Доби", hint: "проживання", Icon: Moon },
  { mode: "fixed" as const, label: "Фіксована", hint: "сума в ₴", Icon: Banknote },
];

type BrandingSettingsPanelProps = {
  settings: AdminSettingsPayload;
  onSettingsChange: (next: AdminSettingsPayload) => void;
  onLogoPreviewChange?: (nextUrl: string | null) => void;
  /** Оновлювати title вкладки під час редагування назви (desktop: лише активна вкладка). */
  isActive?: boolean;
  /** Мобільні налаштування: кнопка виходу лише в «Моя сторінка». */
  showAccountLogout?: boolean;
  onLogout?: () => void;
};

function readBranding(settings: AdminSettingsPayload): PublicBranding {
  return (settings.branding || {}) as PublicBranding;
}

export function BrandingSettingsPanel({
  settings,
  onSettingsChange,
  onLogoPreviewChange,
  isActive = true,
  showAccountLogout = false,
  onLogout,
}: BrandingSettingsPanelProps) {
  const [form, setForm] = useState(() => readBranding(settings));
  const [saving, setSaving] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(
    () => (readBranding(settings).logo_url as string) || null
  );
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [isLogoProcessing, setIsLogoProcessing] = useState(false);
  const [prepaymentOpen, setPrepaymentOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const pendingLogoFileRef = useRef<File | null>(null);
  const serverBrandingKeyRef = useRef("");

  pendingLogoFileRef.current = pendingLogoFile;

  useEffect(() => {
    const brandingKey = JSON.stringify(settings.branding ?? {});
    if (brandingKey === serverBrandingKeyRef.current) return;
    serverBrandingKeyRef.current = brandingKey;

    const next = readBranding(settings);
    setForm(next);

    if (pendingLogoFileRef.current) return;

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    const url = (next.logo_url as string) || null;
    const displayUrl = url && !url.startsWith("blob:") ? normalizeDriveImageUrl(url) : url;
    setLogoPreviewUrl(displayUrl);
    onLogoPreviewChange?.(displayUrl);
  }, [settings.branding, onLogoPreviewChange]);

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      applyAdminDocumentTitle(form.site_title);
      return;
    }
    applyAdminDocumentTitle(readBranding(settings).site_title);
  }, [form.site_title, isActive, settings.branding]);

  const patch = useCallback((key: keyof PublicBranding, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const prepaymentPolicy = readPrepaymentPolicy(form);
  const prepaymentGuestLabel = formatPrepaymentGuestLabel(prepaymentPolicy);
  const setPrepaymentMode = useCallback((mode: PrepaymentMode) => {
    setForm((prev) => {
      const hasValue = prev.prepayment_value !== undefined && prev.prepayment_value !== null;
      const current = Number(prev.prepayment_value);
      const fallback = mode === "percent" ? 50 : mode === "nights" ? 1 : 1000;
      return {
        ...prev,
        prepayment_mode: mode,
        prepayment_value: hasValue
          ? Math.max(0, Number.isFinite(current) ? current : 0)
          : fallback,
      };
    });
  }, []);
  const setPrepaymentValue = useCallback((raw: string, mode: PrepaymentMode) => {
    if (raw === "") {
      setForm((prev) => ({ ...prev, prepayment_value: 0 }));
      return;
    }
    const next = Number(raw);
    if (!Number.isFinite(next) || next < 0) return;
    const capped =
      mode === "percent" ? Math.min(100, next) : mode === "nights" ? Math.min(30, next) : next;
    setForm((prev) => ({ ...prev, prepayment_value: capped }));
  }, []);
  const prepaymentValueInput =
    form.prepayment_value === undefined || form.prepayment_value === null || form.prepayment_value === 0
      ? ""
      : String(form.prepayment_value);

  const setNextLogoPreview = useCallback(
    (nextUrl: string | null, fromBlob = false) => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (fromBlob && nextUrl) blobUrlRef.current = nextUrl;
      const displayUrl =
        nextUrl && !nextUrl.startsWith("blob:") ? normalizeDriveImageUrl(nextUrl) : nextUrl;
      setLogoPreviewUrl(displayUrl);
      onLogoPreviewChange?.(displayUrl);
    },
    [onLogoPreviewChange]
  );

  const handleLogoFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !file.type.startsWith("image/")) return;
      setIsLogoProcessing(true);
      try {
        const compressedFile = await compressImageForUpload(file);
        setPendingLogoFile(compressedFile);
        setNextLogoPreview(URL.createObjectURL(compressedFile), true);
      } catch (error) {
        console.error("[branding] logo compress:", error);
        showToast(
          error instanceof Error && error.message === COMPRESS_FAIL_MESSAGE
            ? COMPRESS_FAIL_MESSAGE
            : "Не вдалося обробити логотип"
        );
      } finally {
        setIsLogoProcessing(false);
      }
    },
    [setNextLogoPreview]
  );

  const handleSave = useCallback(async () => {
    const phoneParts = parseStoredGuestPhone(String(form.contact_phone || ""));
    const normalizedPhone = formatGuestPhoneForSave(
      phoneParts.iso,
      phoneParts.dial,
      phoneParts.national
    );
    if (phoneParts.national && !isValidGuestPhone(phoneParts.iso, phoneParts.dial, phoneParts.national)) {
      showToast("Вкажіть коректний номер телефону для гостей");
      return;
    }

    setSaving(true);
    try {
      let logoUrl = normalizeDriveImageUrl(String(form.logo_url || ""));
      if (pendingLogoFile) {
        const tenantId = getAdminTenantId();
        if (!tenantId) {
          showToast("Не вдалося визначити акаунт");
          return;
        }
        logoUrl = await uploadTenantLogo(pendingLogoFile, tenantId);
        setPendingLogoFile(null);
        pendingLogoFileRef.current = null;
      }

      const mapsExternal = String(form.maps_external_url || "").trim();
      let mapsEmbed = String(form.maps_embed_url || "").trim();
      if (mapsExternal) {
        const resolved = await resolveGoogleMapsEmbedUrl(mapsExternal);
        if (resolved.embedUrl) {
          mapsEmbed = resolved.embedUrl;
        }
      } else {
        mapsEmbed = "";
      }

      const branding: PublicBranding = {
        ...form,
        contact_phone: normalizedPhone || "",
        logo_url: logoUrl || undefined,
        maps_external_url: mapsExternal || undefined,
        maps_embed_url: mapsEmbed || undefined,
      };
      delete branding.site_description;
      const next: AdminSettingsPayload = {
        ...settings,
        branding,
      };
      serverBrandingKeyRef.current = JSON.stringify(next.branding ?? {});
      onSettingsChange(next);
      setForm(readBranding(next));
      setNextLogoPreview(logoUrl || null);
      const tenantId = getAdminTenantId();
      if (tenantId) {
        setCachedTenantLogoUrl(tenantId, logoUrl || null);
      }
      void saveAdminSettings(next, { keys: ["branding"] }).catch((e) => {
        console.error("branding save:", e);
        showToast(e instanceof Error ? e.message : "Не вдалося зберегти профіль");
      });
      showToast("Профіль збережено");
    } catch (e) {
      console.error("branding save:", e);
      showToast(e instanceof Error ? e.message : "Не вдалося зберегти профіль");
    } finally {
      setSaving(false);
    }
  }, [
    form,
    onLogoPreviewChange,
    onSettingsChange,
    pendingLogoFile,
    setNextLogoPreview,
    settings,
  ]);

  const siteTitle = (form.site_title || "").trim();
  const subtitle = siteTitle
    ? `Назва, логотип та контакти для публічної сторінки бронювання «${siteTitle}».`
    : "Назва, логотип та контакти для публічної сторінки бронювання вашої хати.";

  return (
    <div className="branding-settings-panel">
      <div className="branding-settings-header">
        <p className="branding-settings-heading__desc">{subtitle}</p>
      </div>

      <div className="branding-settings-grid">
        <section className="branding-settings-section branding-field--full">
          <div className="branding-settings-section__heading">
            <strong>Основна інформація</strong>
            <span>Ці дані побачать гості на сайті бронювання</span>
          </div>
          <div className="branding-settings-section__grid">
            <label className="branding-field">
              <span>Назва на сайті</span>
              <input
                type="text"
                value={form.site_title || ""}
                placeholder="ХАТА"
                onChange={(e) => patch("site_title", e.target.value)}
              />
            </label>

            <label className="branding-field">
              <span>Телефон для гостей</span>
              <GuestPhoneField
                value={String(form.contact_phone || "")}
                disabled={saving}
                onChange={(value) => patch("contact_phone", value)}
              />
            </label>
            <label className="branding-field branding-field--full">
              <span>Посилання на карту (Google Maps)</span>
              <input
                type="url"
                value={form.maps_external_url || ""}
                placeholder="https://maps.google.com/..."
                onChange={(e) => patch("maps_external_url", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section
          className={`svc-accordion branding-prepayment-accordion branding-field--full${prepaymentOpen ? " is-open" : ""}`}
        >
          <button
            type="button"
            className="svc-accordion__trigger"
            aria-expanded={prepaymentOpen}
            aria-controls="branding-prepayment-panel"
            onClick={() => setPrepaymentOpen((v) => !v)}
          >
            <div className="svc-accordion__trigger-main">
              <span className="svc-accordion__icon" aria-hidden>
                <Wallet size={18} />
              </span>
              <div className="svc-accordion__trigger-text">
                <span className="svc-accordion__label">Передплата для гостей</span>
                <span className="svc-accordion__hint">{prepaymentGuestLabel}</span>
              </div>
            </div>
            <ChevronDown size={18} className="svc-accordion__chevron" aria-hidden />
          </button>

          <div
            id="branding-prepayment-panel"
            className="branding-prepayment-collapse svc-accordion__collapse"
            aria-hidden={!prepaymentOpen}
            inert={!prepaymentOpen}
          >
            <div className="branding-prepayment-collapse__panel">
              <div className="branding-prepayment-collapse__content svc-accordion__panel">
              <p className="svc-accordion__intro">
                Скільки гість сплачує онлайн для підтвердження броні. Решту — на місці при заїзді.
              </p>

              <div className="svc-accordion__section">
                <div className="svc-field">
                  <span className="svc-field__label">Тип передплати</span>
                  <div className="svc-pricing-grid branding-prepayment-modes">
                    {PREPAYMENT_MODES.map((option) => (
                      <button
                        key={option.mode}
                        type="button"
                        className={`svc-pricing-card${prepaymentPolicy.mode === option.mode ? " is-active" : ""}`}
                        onClick={() => setPrepaymentMode(option.mode)}
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
              </div>

              <div className="svc-accordion__section">
                <label className="svc-field branding-prepayment-value">
                  <span className="svc-field__label">
                    {prepaymentPolicy.mode === "percent"
                      ? "Відсоток від загальної суми"
                      : prepaymentPolicy.mode === "nights"
                        ? "Кількість діб проживання"
                        : "Сума передплати"}
                  </span>
                  <div
                    className={`svc-field__suffix-wrap${prepaymentPolicy.mode === "nights" ? " svc-field__suffix-wrap--doba" : ""}`}
                  >
                    <input
                      className="svc-field__input"
                      type="number"
                      min={0}
                      max={prepaymentPolicy.mode === "percent" ? 100 : undefined}
                      value={prepaymentValueInput}
                      placeholder="0"
                      onChange={(e) => setPrepaymentValue(e.target.value, prepaymentPolicy.mode)}
                    />
                    {prepaymentPolicy.mode === "percent" ? (
                      <span className="svc-field__suffix">%</span>
                    ) : prepaymentPolicy.mode === "fixed" ? (
                      <span className="svc-field__suffix">₴</span>
                    ) : (
                      <span className="svc-field__suffix">
                        {dobaWord(prepaymentPolicy.value > 0 ? prepaymentPolicy.value : 1)}
                      </span>
                    )}
                  </div>
                  {prepaymentPolicy.value <= 0 ? (
                    <span className="svc-field__caption">Порожнє поле — без передплати (0 грн)</span>
                  ) : null}
                </label>
              </div>

              <div className="svc-accordion__section">
                <p className="branding-prepayment-preview">{prepaymentGuestLabel}</p>
              </div>
              </div>
            </div>
          </div>
        </section>

        <div className="branding-logo-row branding-field--full">
          <div className="branding-logo-row__main branding-field branding-field--logo">
            <span>Логотип</span>
            <div
              className="branding-logo-upload"
              title="Завантажити логотип"
              style={
                {
                  "--logo-accent": "var(--accent)",
                } as CSSProperties
              }
            >
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="branding-logo-upload__input"
                aria-label="Завантажити логотип"
                disabled={isLogoProcessing || saving}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  void handleLogoFile(file);
                  e.currentTarget.value = "";
                }}
              />
              {logoPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={toImageDisplaySrc(logoPreviewUrl)}
                  alt="Логотип"
                  className="branding-logo-upload__img"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="branding-logo-upload__placeholder">
                  <ImagePlus className="h-5 w-5" strokeWidth={1.8} />
                  <span>Завантажити</span>
                </div>
              )}
              {isLogoProcessing ? (
                <span className="branding-logo-upload__overlay">Обробка…</span>
              ) : null}
            </div>
            <p className="branding-logo-upload__hint">
              PNG, JPG або WebP. Відображається в адмінці та на сайті бронювання.
            </p>
          </div>
          <div className="branding-logo-row__action">
            <button
              type="button"
              className="btn-primary settings-save-action--sticky"
              disabled={saving || isLogoProcessing}
              onClick={() => void handleSave()}
            >
              {saving ? "Збереження…" : "Зберегти профіль"}
            </button>
          </div>
        </div>

        {showAccountLogout ? (
          <div className="mobile-settings-account">
            <button
              type="button"
              className="btn-secondary mobile-logout-btn tap-btn"
              onClick={() => {
                if (onLogout) {
                  onLogout();
                  return;
                }
                (window as Window & { BosoAuth?: { logout?: () => void } }).BosoAuth?.logout?.();
              }}
            >
              Вийти з акаунту
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
