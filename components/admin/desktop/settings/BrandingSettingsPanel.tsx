"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ImagePlus } from "lucide-react";
import { saveAdminSettings, getAdminTenantId } from "../adminApi";
import { showToast } from "../adminGlobals";
import type { AdminSettingsPayload } from "../types";
import type { PublicBranding } from "@/lib/public-booking/types";
import {
  resolveStayRulesForEditing,
  serializeStayRulesForSave,
  type StayRulesContent,
} from "@/lib/public-booking/stayRules";
import { StayRulesSettingsAccordion } from "./StayRulesSettingsAccordion";
import { GuestPhoneField } from "@/components/admin/onboarding/GuestPhoneField";
import {
  formatGuestPhoneForSave,
  isValidGuestPhone,
  parseStoredGuestPhone,
} from "@/lib/admin/onboarding/uaPhone";
import {
  COMPRESS_FAIL_MESSAGE,
  compressLogoForUpload,
} from "@/lib/admin/onboarding/mediaCompression";
import { uploadTenantLogo } from "@/utils/tenantLogoStorage";
import { normalizeDriveImageUrl, toImageDisplaySrc } from "@/lib/driveImageUrl";
import { resolveGoogleMapsEmbedUrl } from "@/lib/googleMapsUrl";
import { setCachedTenantLogoUrl } from "@/lib/admin/brandingLogoCache";
import { applyAdminDocumentTitle } from "@/lib/admin/adminDocumentTitle";
import "../settings/settings-additional-services.css";

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
  const [stayRulesOpen, setStayRulesOpen] = useState(false);
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

  const stayRules = resolveStayRulesForEditing(form);
  const setStayRules = useCallback((next: StayRulesContent) => {
    setForm((prev) => ({ ...prev, stay_rules: next }));
  }, []);

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
        const compressedFile = await compressLogoForUpload(file);
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
        stay_rules: serializeStayRulesForSave(resolveStayRulesForEditing(form)),
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

        <StayRulesSettingsAccordion
          open={stayRulesOpen}
          onToggle={() => setStayRulesOpen((v) => !v)}
          value={stayRules}
          onChange={setStayRules}
        />

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
              PNG без фону (прозорий). Білий фон більше не додається. Логотип
              піде в адмінку, прелоадер, сайт і іконки біля посилання.
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
