"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Banknote, ChevronDown } from "lucide-react";
import { buildDefaultAmenitiesState } from "@/constants/amenitiesDict";
import { buildDefaultHouseRulesState, HOUSE_RULES_CATEGORY_ID } from "@/constants/rulesDict";
import { showToast } from "@/components/admin/desktop/adminGlobals";
import { isRoomDraftId } from "@/lib/admin/roomDraft";
import type { AdminModalsApi, RoomAccordionKey } from "@/components/admin/desktop/useAdminModals";
import type { AdminSettingsPayload, RoomConfig, RoomSiteHighlight } from "@/components/admin/desktop/types";
import {
  normalizeSiteHighlights,
  siteHighlightsForSave,
} from "@/lib/admin/roomSiteHighlights";
import { normalizeRoomCategories } from "@/lib/admin/roomCategories";
import { AmenityCategoryDisclosureList } from "./AmenityCategoryDisclosureList";
import { RulesCategoryDisclosureList } from "./RulesCategoryDisclosureList";
import { CapacityStepperField } from "./CapacityStepperField";
import { RoomGallerySection } from "./RoomGallerySection";
import { RoomSiteHighlightsEditor } from "./RoomSiteHighlightsEditor";
import {
  ROOM_SETTINGS_STEPS,
  getActiveAmenityIds,
  getActiveRuleIds,
  type RoomSettingsStepId,
} from "./roomSettingsSteps";
import {
  DEFAULT_PRICE_WEEKEND_DAYS,
  PRICE_WEEKDAY_CHIP_ORDER,
  PRICE_WEEKDAY_LABELS_UK,
  normalizePriceWeekendDays,
} from "@/lib/pricing/priceWeekendDays";
import "@/components/admin/onboarding/onboarding.css";
import "./settings-rooms-accordion.css";

export type RoomSettingsAccordionProps = {
  roomKey: RoomAccordionKey;
  room: RoomConfig | null;
  settings: AdminSettingsPayload;
  modals: AdminModalsApi;
  /** Мобільний шит: закрити після успішного збереження / видалення. */
  onSaved?: () => void;
  onDeleted?: () => void;
  /** Відкрити крок одразу (мобільний шит). */
  initialStepId?: RoomSettingsStepId | null;
};

function Spinner() {
  return (
    <svg className="khata-onboarding__spinner" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  );
}

export function RoomSettingsAccordion({
  roomKey,
  room,
  settings,
  modals,
  onSaved,
  onDeleted,
  initialStepId,
}: RoomSettingsAccordionProps) {
  const resolvedRoom =
    room ?? (settings.roomsList || []).find((r) => r.id === roomKey) ?? null;

  const [activeStepId, setActiveStepId] = useState<RoomSettingsStepId | null>(
    () => initialStepId ?? null
  );
  const [saving, setSaving] = useState(false);

  const initialDraft = resolvedRoom ? isRoomDraftId(resolvedRoom.id) : isRoomDraftId(roomKey);
  const initialCap = initialDraft
    ? (resolvedRoom?.capacity ?? 0)
    : Math.max(1, resolvedRoom?.capacity ?? 2);
  const initialMax = resolvedRoom?.maxCapacity ?? initialCap;

  const [name, setName] = useState(resolvedRoom?.name ?? "");
  const [chessboardName, setChessboardName] = useState(
    () => resolvedRoom?.short?.trim() || resolvedRoom?.name || ""
  );
  const [categoryId, setCategoryId] = useState(resolvedRoom?.categoryId || "");
  const [siteDescription, setSiteDescription] = useState(
    resolvedRoom?.detailedDescription ?? ""
  );
  const [mainPlaces, setMainPlaces] = useState(String(initialCap));
  const [extraPlaces, setExtraPlaces] = useState(() =>
    String(Math.max(0, initialMax - initialCap))
  );
  const [extraGuestPrice, setExtraGuestPrice] = useState(
    String(resolvedRoom?.extraGuestPrice ?? 2500)
  );
  const [extraGuestFeeMode, setExtraGuestFeeMode] = useState<"per_night" | "per_stay">(
    resolvedRoom?.extraGuestFeeMode ?? "per_night"
  );
  const [allowChildren, setAllowChildren] = useState(resolvedRoom?.allowChildren !== false);
  const [minChildAge, setMinChildAge] = useState(() =>
    String(
      resolvedRoom?.minChildAge != null && Number.isFinite(Number(resolvedRoom.minChildAge))
        ? Math.max(0, Math.round(Number(resolvedRoom.minChildAge)))
        : 0
    )
  );
  const [siteHighlights, setSiteHighlights] = useState<RoomSiteHighlight[]>(() =>
    normalizeSiteHighlights(resolvedRoom?.siteHighlights)
  );
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(() =>
    resolvedRoom ? getActiveAmenityIds(resolvedRoom) : []
  );
  const [selectedRules, setSelectedRules] = useState<string[]>(() =>
    resolvedRoom ? getActiveRuleIds(resolvedRoom) : []
  );
  const selectedAmenitySet = useMemo(() => new Set(selectedAmenities), [selectedAmenities]);
  const selectedRuleSet = useMemo(() => new Set(selectedRules), [selectedRules]);
  const [priceWeekday, setPriceWeekday] = useState(String(resolvedRoom?.priceWeekday ?? ""));
  const [priceWeekend, setPriceWeekend] = useState(String(resolvedRoom?.priceWeekend ?? ""));
  const [priceOneNightWeekday, setPriceOneNightWeekday] = useState(
    String(resolvedRoom?.priceOneNightWeekday || "")
  );
  const [priceOneNightWeekend, setPriceOneNightWeekend] = useState(
    String(resolvedRoom?.priceOneNightWeekend || "")
  );
  const [weekendDays, setWeekendDays] = useState<number[]>(() =>
    normalizePriceWeekendDays(resolvedRoom?.weekendDays ?? DEFAULT_PRICE_WEEKEND_DAYS)
  );

  const effectiveRoomId = resolvedRoom?.id ?? roomKey;
  const isDraft = isRoomDraftId(effectiveRoomId);
  const [localPhotos, setLocalPhotos] = useState<string[]>(() => resolvedRoom?.photos ?? []);
  const localPhotosRef = useRef(localPhotos);
  localPhotosRef.current = localPhotos;

  const pendingPhotosRef = useRef<Map<string, File>>(new Map());
  const [photoStagingBusy, setPhotoStagingBusy] = useState(false);
  const hydratedKeyRef = useRef<string | null>(null);
  const hydrationKey = String(roomKey);

  const revokePendingPhoto = useCallback((url: string) => {
    if (!url.startsWith("blob:")) return;
    URL.revokeObjectURL(url);
    pendingPhotosRef.current.delete(url);
  }, []);

  useEffect(() => {
    const pending = pendingPhotosRef.current;
    return () => {
      for (const url of pending.keys()) URL.revokeObjectURL(url);
      pending.clear();
    };
  }, []);

  useEffect(() => {
    if (!resolvedRoom) return;
    if (hydratedKeyRef.current === hydrationKey) return;
    hydratedKeyRef.current = hydrationKey;

    const draft = isRoomDraftId(resolvedRoom.id);
    setActiveStepId(draft ? "info" : (initialStepId ?? null));

    const cap = draft ? (resolvedRoom.capacity ?? 0) : Math.max(1, resolvedRoom.capacity || 2);
    const max = draft ? (resolvedRoom.maxCapacity ?? cap) : (resolvedRoom.maxCapacity ?? cap);
    setName(resolvedRoom.name);
    setChessboardName(resolvedRoom.short?.trim() || resolvedRoom.name || "");
    setCategoryId(resolvedRoom.categoryId || "");
    setSiteDescription(resolvedRoom.detailedDescription ?? "");
    setMainPlaces(String(cap));
    setExtraPlaces(String(Math.max(0, max - cap)));
    setExtraGuestPrice(String(resolvedRoom.extraGuestPrice ?? 2500));
    setExtraGuestFeeMode(resolvedRoom.extraGuestFeeMode ?? "per_night");
    setAllowChildren(resolvedRoom.allowChildren !== false);
    setMinChildAge(
      String(
        resolvedRoom.minChildAge != null && Number.isFinite(Number(resolvedRoom.minChildAge))
          ? Math.max(0, Math.round(Number(resolvedRoom.minChildAge)))
          : 0
      )
    );
    setSiteHighlights(normalizeSiteHighlights(resolvedRoom.siteHighlights));
    setSelectedAmenities(getActiveAmenityIds(resolvedRoom));
    setSelectedRules(getActiveRuleIds(resolvedRoom));
    setPriceWeekday(String(resolvedRoom.priceWeekday || ""));
    setPriceWeekend(String(resolvedRoom.priceWeekend || ""));
    setPriceOneNightWeekday(
      resolvedRoom.priceOneNightWeekday && Number(resolvedRoom.priceOneNightWeekday) > 0
        ? String(resolvedRoom.priceOneNightWeekday)
        : ""
    );
    setPriceOneNightWeekend(
      resolvedRoom.priceOneNightWeekend && Number(resolvedRoom.priceOneNightWeekend) > 0
        ? String(resolvedRoom.priceOneNightWeekend)
        : ""
    );
    setWeekendDays(
      normalizePriceWeekendDays(resolvedRoom.weekendDays ?? DEFAULT_PRICE_WEEKEND_DAYS)
    );
    setLocalPhotos(resolvedRoom.photos ?? []);
  }, [hydrationKey, initialStepId, resolvedRoom, roomKey]);

  useEffect(() => {
    if (!isDraft || effectiveRoomId == null) return;
    const timer = window.setTimeout(() => {
      const siteName = name.trim();
      const boardName = chessboardName.trim() || siteName;
      modals.patchRoomQuickEdit(effectiveRoomId, {
        name: siteName,
        short: boardName,
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [chessboardName, effectiveRoomId, isDraft, modals, name]);

  useEffect(() => {
    if (!resolvedRoom) return;
    const incoming = resolvedRoom.photos ?? [];
    setLocalPhotos((prev) => {
      if (prev.length === incoming.length && prev.every((url, i) => url === incoming[i])) {
        return prev;
      }
      return incoming;
    });
  }, [resolvedRoom?.photos, roomKey]);

  const handlePhotoFiles = useCallback(
    async (files: FileList | File[] | undefined) => {
      if (!files || files.length === 0) return;
      if (effectiveRoomId == null || isRoomDraftId(effectiveRoomId)) {
        showToast("Спочатку збережи зміни в «Основній інформації»");
        return;
      }
      const inputFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!inputFiles.length) return;
      try {
        const dataTransfer = new DataTransfer();
        inputFiles.forEach((f) => dataTransfer.items.add(f));
        const urls = await modals.uploadPhotosForRoom(effectiveRoomId, dataTransfer.files);
        if (urls.length > 0) {
          setLocalPhotos((prev) => [...prev, ...urls]);
        }
      } catch (error) {
        console.error("[room-settings] photo:", error);
        showToast("Не вдалося обробити фото");
      }
    },
    [effectiveRoomId, modals, isDraft]
  );

  const buildAmenitiesPayload = () => {
    const defaults = buildDefaultAmenitiesState();
    const selectedSet = new Set(selectedAmenities);
    const currentAmenities = resolvedRoom?.amenities || {};
    for (const [categoryId, items] of Object.entries(defaults)) {
      const currentById = new Map((currentAmenities[categoryId] || []).map((item) => [item.id, item]));
      defaults[categoryId] = items.map((item) => ({
        ...item,
        ...(currentById.get(item.id) || {}),
        isActive: selectedSet.has(item.id),
      }));
    }

    const rulesDefaults = buildDefaultHouseRulesState();
    const selectedRulesSet = new Set(selectedRules);
    const currentRules = currentAmenities[HOUSE_RULES_CATEGORY_ID] || [];
    const currentRulesById = new Map(currentRules.map((item) => [item.id, item]));
    rulesDefaults[HOUSE_RULES_CATEGORY_ID] = rulesDefaults[HOUSE_RULES_CATEGORY_ID].map((item) => ({
      ...item,
      ...(currentRulesById.get(item.id) || {}),
      isActive: selectedRulesSet.has(item.id),
    }));

    return { ...defaults, ...rulesDefaults };
  };

  const handlePhotosChange = useCallback(
    async (photos: string[]) => {
      const previous = localPhotosRef.current;
      for (const url of previous) {
        if (url.startsWith("blob:") && !photos.includes(url)) revokePendingPhoto(url);
      }
      setLocalPhotos(photos);
      if (effectiveRoomId == null || isRoomDraftId(effectiveRoomId)) {
        queueMicrotask(() => {
          modals.patchRoomQuickEdit(effectiveRoomId, { photos });
        });
        return;
      }
      try {
        await modals.setRoomPhotos(effectiveRoomId, photos);
      } catch (error) {
        console.error("[room-settings] photos:", error);
        setLocalPhotos(previous);
        showToast("Не вдалося оновити галерею");
      }
    },
    [effectiveRoomId, modals, revokePendingPhoto]
  );

  const handleSaveAll = async () => {
    const roomName = name.trim();
    if (!roomName) {
      showToast("Вкажи назву житла на сайті");
      setActiveStepId("info");
      return;
    }
    const boardName = chessboardName.trim() || roomName;
    if (selectedAmenities.length === 0) {
      showToast("Обери хоча б одну зручність");
      setActiveStepId("amenities");
      return;
    }
    const weekday = Math.max(0, Number(priceWeekday) || 0);
    const weekend = Math.max(0, Number(priceWeekend) || 0);
    const oneNightWeekday = Math.max(0, Number(priceOneNightWeekday) || 0);
    const oneNightWeekend = Math.max(0, Number(priceOneNightWeekend) || 0);
    const savedWeekendDays = normalizePriceWeekendDays(weekendDays);
    if (weekday <= 0 || weekend <= 0) {
      showToast("Вкажи ціни на будні та вихідні");
      setActiveStepId("prices");
      return;
    }
    if (savedWeekendDays.length === 0) {
      showToast("Обери хоча б один день для вихідного тарифу");
      setActiveStepId("prices");
      return;
    }
    if (savedWeekendDays.length >= 7) {
      showToast("Залиш хоча б один день для звичайного тарифу");
      setActiveStepId("prices");
      return;
    }

    const capacity = Math.max(1, Number(mainPlaces) || 2);
    const extra = Math.max(0, Number(extraPlaces) || 0);
    const saveKey = effectiveRoomId ?? roomKey;
    const parsedMinAge = Math.max(0, Math.min(17, Math.round(Number(minChildAge) || 0)));

    setSaving(true);
    try {
      const resolvedId = await modals.saveRoomSettings(saveKey, {
        name: roomName,
        short: boardName,
        detailedDescription: siteDescription.trim(),
        capacity,
        maxCapacity: capacity + extra,
        extraGuestPrice: Math.max(0, Number(extraGuestPrice) || 0),
        extraGuestFeeMode,
        categoryId: categoryId || null,
        allowChildren,
        minChildAge: allowChildren ? parsedMinAge : null,
        siteHighlights: siteHighlightsForSave(siteHighlights),
        amenities: buildAmenitiesPayload(),
        priceWeekday: weekday,
        priceWeekend: weekend,
        weekendDays: savedWeekendDays,
        priceOneNightWeekday: oneNightWeekday,
        priceOneNightWeekend: oneNightWeekend,
      });

      const pendingFiles = Array.from(pendingPhotosRef.current.values());
      if (pendingFiles.length > 0) {
        const dataTransfer = new DataTransfer();
        pendingFiles.forEach((f) => dataTransfer.items.add(f));
        const uploaded = await modals.uploadPhotosForRoom(resolvedId, dataTransfer.files, {
          silent: true,
        });
        const kept = localPhotosRef.current.filter((u) => !u.startsWith("blob:"));
        const merged = [...kept, ...uploaded];
        for (const url of pendingPhotosRef.current.keys()) URL.revokeObjectURL(url);
        pendingPhotosRef.current.clear();
        setLocalPhotos(merged);
      }

      showToast(isDraft ? "Житло створено" : "Зміни збережено");
      onSaved?.();
    } catch (error) {
      console.error("[room-settings] save:", error);
      showToast("Не вдалося зберегти");
    } finally {
      setSaving(false);
    }
  };

  const toggleAmenity = (amenityId: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenityId) ? prev.filter((id) => id !== amenityId) : [...prev, amenityId]
    );
  };

  const toggleRule = (ruleId: string) => {
    setSelectedRules((prev) =>
      prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId]
    );
  };

  const handleDeleteRoom = () => {
    if (isDraft) {
      modals.discardRoomDraft(effectiveRoomId);
      onDeleted?.();
      return;
    }
    modals.deleteGenericItem("room", effectiveRoomId);
  };

  if (!resolvedRoom) return null;

  return (
    <div className="khata-room-settings">
      <ol className="khata-room-steps">
        {ROOM_SETTINGS_STEPS.map((step) => {
          const open = activeStepId === step.id;
          const StepIcon = step.Icon;

          return (
            <li key={step.id} className={`khata-room-step${open ? " is-open" : ""}`}>
              <button
                type="button"
                className="khata-room-step__head"
                onClick={() => setActiveStepId((prev) => (prev === step.id ? null : step.id))}
                aria-expanded={open}
              >
                <span className="khata-room-step__icon-wrap" aria-hidden>
                  <StepIcon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <span className="khata-room-step__text">
                  <span className="khata-room-step__title">{step.title}</span>
                  <span className="khata-room-step__desc">{step.description}</span>
                </span>
                <ChevronDown
                  className={`khata-room-step__chevron h-4 w-4 shrink-0${open ? " is-open" : ""}`}
                  aria-hidden
                />
              </button>

              <div className={`khata-room-step__body-wrap${open ? " is-open" : ""}`}>
                <div className="khata-room-step__body">
                  {step.id === "info" ? (
                    <div className="khata-room-step__content">
                      <label className="khata-room-field">
                        <span className="khata-room-field__label">Назва житла на сайті</span>
                        <input
                          className="khata-room-field__input"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Напр. Будиночок біля озера"
                        />
                      </label>

                      <label className="khata-room-field">
                        <span className="khata-room-field__label">Назва житла в шахматці</span>
                        <input
                          className="khata-room-field__input"
                          value={chessboardName}
                          onChange={(e) => setChessboardName(e.target.value)}
                          placeholder="Напр. Будиночок 1"
                        />
                      </label>

                      {normalizeRoomCategories(settings.roomCategoriesList).length > 0 ? (
                        <label className="khata-room-field">
                          <span className="khata-room-field__label">Категорія</span>
                          <select
                            className="khata-room-field__input khata-room-field__select"
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                          >
                            <option value="">Без категорії</option>
                            {normalizeRoomCategories(settings.roomCategoriesList).map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                                {cat.hidden ? " (прихована)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <label className="khata-room-field">
                        <span className="khata-room-field__label">Опис для сайту</span>
                        <textarea
                          className="khata-room-field__textarea"
                          value={siteDescription}
                          onChange={(e) => setSiteDescription(e.target.value)}
                          placeholder="Розкажи гостям про атмосферу..."
                          rows={5}
                        />
                      </label>

                      <div className="khata-room-settings__capacity-row">
                        <CapacityStepperField
                          label="Основні місця"
                          value={mainPlaces}
                          min={isDraft ? 0 : 1}
                          max={30}
                          onChange={setMainPlaces}
                        />
                        <CapacityStepperField
                          label="Додаткові місця"
                          value={extraPlaces}
                          min={0}
                          max={20}
                          onChange={setExtraPlaces}
                        />
                      </div>

                      {Number(extraPlaces) > 0 && (
                        <div className="khata-room-settings__extra-guests">
                          <div className="khata-room-settings__extra-guests-header">
                            Додаткові гості
                          </div>
                          <div className="khata-room-settings__extra-guests-row">
                            <label className="khata-room-field khata-room-field--inline">
                              <span className="khata-room-field__label">
                                Ціна за додаткового гостя (грн)
                              </span>
                              <input
                                className="khata-room-field__input khata-room-field__input--narrow"
                                type="number"
                                min={0}
                                value={extraGuestPrice}
                                onChange={(e) => setExtraGuestPrice(e.target.value)}
                              />
                            </label>
                            <div className="khata-room-settings__fee-mode">
                              <button
                                type="button"
                                className={`khata-room-settings__fee-mode-btn${extraGuestFeeMode === "per_night" ? " khata-room-settings__fee-mode-btn--active" : ""}`}
                                onClick={() => setExtraGuestFeeMode("per_night")}
                              >
                                За ніч
                              </button>
                              <button
                                type="button"
                                className={`khata-room-settings__fee-mode-btn${extraGuestFeeMode === "per_stay" ? " khata-room-settings__fee-mode-btn--active" : ""}`}
                                onClick={() => setExtraGuestFeeMode("per_stay")}
                              >
                                За весь період
                              </button>
                            </div>
                          </div>
                          <p className="khata-room-settings__extra-guests-hint">
                            Гості понад {mainPlaces || "0"} оплачуються додатково
                          </p>
                        </div>
                      )}

                      <div className="khata-room-settings__children-policy">
                        <label className="khata-room-settings__children-toggle">
                          <input
                            type="checkbox"
                            checked={allowChildren}
                            onChange={(e) => setAllowChildren(e.target.checked)}
                          />
                          <span>
                            <strong>Можна з дітьми</strong>
                            <span className="khata-room-settings__children-toggle-hint">
                              {allowChildren
                                ? "Гості зможуть вказати дітей у бронюванні"
                                : "Будинок лише для дорослих"}
                            </span>
                          </span>
                        </label>
                        {allowChildren ? (
                          <CapacityStepperField
                            label="Мінімальний вік дитини"
                            hint="Наприклад, 10 — діти молодше не підійдуть. 0 — без обмеження."
                            value={minChildAge}
                            min={0}
                            max={17}
                            onChange={setMinChildAge}
                          />
                        ) : null}
                      </div>

                      <RoomSiteHighlightsEditor
                        value={siteHighlights}
                        onChange={setSiteHighlights}
                        disabled={saving}
                      />
                    </div>
                  ) : null}

                  {step.id === "gallery" ? (
                    <RoomGallerySection
                      photos={localPhotos}
                      roomId={effectiveRoomId}
                      busy={modals.roomPhotosBusy || photoStagingBusy}
                      onFiles={handlePhotoFiles}
                      onPhotosChange={handlePhotosChange}
                    />
                  ) : null}

                  {step.id === "amenities" ? (
                    <AmenityCategoryDisclosureList
                      selectedIds={selectedAmenitySet}
                      onToggle={toggleAmenity}
                      disabled={saving}
                    />
                  ) : null}

                  {step.id === "rules" ? (
                    <RulesCategoryDisclosureList
                      selectedIds={selectedRuleSet}
                      onToggle={toggleRule}
                      disabled={saving}
                    />
                  ) : null}

                  {step.id === "prices" ? (
                    <div className="khata-room-step__content khata-room-step__content--prices">
                      <div className="khata-room-field khata-room-field--full">
                        <span className="khata-room-field__label">
                          Дорожчі дні (вихідний тариф)
                        </span>
                        <div className="khata-room-weekend-days" role="group" aria-label="Дні вихідного тарифу">
                          {PRICE_WEEKDAY_CHIP_ORDER.map((dow) => {
                            const active = weekendDays.includes(dow);
                            return (
                              <button
                                key={dow}
                                type="button"
                                className={`khata-room-weekend-day${active ? " is-active" : ""}`}
                                aria-pressed={active}
                                onClick={() =>
                                  setWeekendDays((prev) => {
                                    if (prev.includes(dow)) {
                                      const next = prev.filter((d) => d !== dow);
                                      return next.length ? next : prev;
                                    }
                                    return normalizePriceWeekendDays([...prev, dow]);
                                  })
                                }
                              >
                                {PRICE_WEEKDAY_LABELS_UK[dow]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <label className="khata-room-field">
                        <span className="khata-room-field__label khata-room-field__label--with-icon">
                          <Banknote className="h-3.5 w-3.5 text-stone-400" strokeWidth={2} />
                          Ціна 2+ ночей (звичайні дні)
                        </span>
                        <div className="khata-onboarding__price-input-wrap">
                          <span className="khata-onboarding__currency-prefix">₴</span>
                          <input
                            type="number"
                            min={0}
                            value={priceWeekday}
                            onChange={(e) => setPriceWeekday(e.target.value)}
                            placeholder="0"
                            className="khata-onboarding__price-input khata-room-field__input"
                          />
                        </div>
                      </label>
                      <label className="khata-room-field">
                        <span className="khata-room-field__label khata-room-field__label--with-icon">
                          <Banknote className="h-3.5 w-3.5 text-stone-400" strokeWidth={2} />
                          Ціна 2+ ночей (дорожчі дні)
                        </span>
                        <div className="khata-onboarding__price-input-wrap">
                          <span className="khata-onboarding__currency-prefix">₴</span>
                          <input
                            type="number"
                            min={0}
                            value={priceWeekend}
                            onChange={(e) => setPriceWeekend(e.target.value)}
                            placeholder="0"
                            className="khata-onboarding__price-input khata-room-field__input"
                          />
                        </div>
                      </label>
                      <label className="khata-room-field">
                        <span className="khata-room-field__label khata-room-field__label--with-icon">
                          <Banknote className="h-3.5 w-3.5 text-stone-400" strokeWidth={2} />
                          Ціна за 1 ніч (звичайні дні)
                        </span>
                        <div className="khata-onboarding__price-input-wrap">
                          <span className="khata-onboarding__currency-prefix">₴</span>
                          <input
                            type="number"
                            min={0}
                            value={priceOneNightWeekday}
                            onChange={(e) => setPriceOneNightWeekday(e.target.value)}
                            placeholder={priceWeekday || "як 2+"}
                            className="khata-onboarding__price-input khata-room-field__input"
                          />
                        </div>
                      </label>
                      <label className="khata-room-field">
                        <span className="khata-room-field__label khata-room-field__label--with-icon">
                          <Banknote className="h-3.5 w-3.5 text-stone-400" strokeWidth={2} />
                          Ціна за 1 ніч (дорожчі дні)
                        </span>
                        <div className="khata-onboarding__price-input-wrap">
                          <span className="khata-onboarding__currency-prefix">₴</span>
                          <input
                            type="number"
                            min={0}
                            value={priceOneNightWeekend}
                            onChange={(e) => setPriceOneNightWeekend(e.target.value)}
                            placeholder={priceWeekend || "як 2+"}
                            className="khata-onboarding__price-input khata-room-field__input"
                          />
                        </div>
                      </label>
                      <p className="khata-room-settings__price-hint">
                        Якщо «за 1 ніч» порожнє — береться ціна 2+. На сайті й у броні при 1 ночі
                        підставиться цей тариф автоматично. Детальні дати — у «Ціни та тарифи».
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="khata-room-settings__footer">
        <button
          type="button"
          className="khata-room-settings__delete"
          onClick={handleDeleteRoom}
        >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Видалити житло
          </button>
        <button
          type="button"
          className="btn-primary khata-room-settings__save"
          disabled={saving}
          onClick={() => void handleSaveAll()}
        >
          {saving ? <Spinner /> : null}
          Зберегти зміни
        </button>
      </footer>
    </div>
  );
}
