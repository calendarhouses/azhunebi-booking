"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  Armchair,
  Baby,
  Bath,
  Bed,
  BedDouble,
  Car,
  ChefHat,
  ChevronDown,
  CigaretteOff,
  Coffee,
  CookingPot,
  Droplets,
  Flame,
  Home,
  Heater,
  KeyRound,
  Lamp,
  LandPlot,
  Layers,
  Microwave,
  Moon,
  Mountain,
  PawPrint,
  Refrigerator,
  Shirt,
  ShowerHead,
  Snowflake,
  Sofa,
  Sparkles,
  Trees,
  Tv,
  UtensilsCrossed,
  ImagePlus,
  UploadCloud,
  X,
  Wallet,
  WashingMachine,
  Waves,
  Wind,
  Wifi,
} from "lucide-react";
import { AMENITIES_CATEGORIES, buildDefaultAmenitiesState } from "@/constants/amenitiesDict";
import { saveAdminSettings } from "@/components/admin/desktop/adminApi";
import { showToast } from "@/components/admin/desktop/adminGlobals";
import { KhataBrandIcon } from "@/components/ui/icons/KhataBrandIcon";
import { computeOnboardingProgress } from "@/lib/admin/onboarding/computeOnboardingProgress";
import { GuestPhoneField } from "./GuestPhoneField";
import { compressImageToWebp } from "@/lib/admin/onboarding/mediaCompression";
import {
  formatGuestPhoneForSave,
  isValidGuestPhone,
  parseStoredGuestPhone,
} from "@/lib/admin/onboarding/uaPhone";
import type { OnboardingStepId } from "@/lib/admin/onboarding/types";
import type { AdminSettingsPayload, RoomConfig } from "@/components/admin/desktop/types";
import "./onboarding.css";

export type OnboardingWidgetProps = {
  settings: AdminSettingsPayload;
  tenantName?: string | null;
  onSettingsChange: (next: AdminSettingsPayload) => void;
  onLogoPreviewChange?: (nextUrl: string | null) => void;
};

const POPULAR_AMENITIES = [
  "wifi",
  "parking",
  "shower",
  "ac",
  "heating",
  "tv",
  "bbq",
  "vat",
  "terrace",
  "forest_view",
  "lake_view",
  "sauna",
  "pool",
  "fireplace",
  "fridge",
  "microwave",
  "kettle",
  "bath",
  "towels",
  "hairdryer",
  "toiletries",
  "bathrobes",
  "stove",
  "dishes",
  "coffee",
  "double_bed",
  "separate_beds",
  "sofa_bed",
  "grill",
  "outdoor_furniture",
  "kids_area",
  "private_area",
  "pets_possible",
  "self_checkin",
  "quiet_hours",
  "no_smoking_inside",
  "extra_blankets",
  "washing_machine",
] as const;

const AMENITY_ICONS: Record<(typeof POPULAR_AMENITIES)[number], ComponentType<{ className?: string }>> = {
  wifi: Wifi,
  parking: Car,
  shower: ShowerHead,
  ac: Snowflake,
  heating: Heater,
  tv: Tv,
  bbq: Flame,
  vat: Waves,
  terrace: Home,
  forest_view: Trees,
  lake_view: Mountain,
  sauna: Heater,
  pool: Waves,
  fireplace: Lamp,
  fridge: Refrigerator,
  microwave: Microwave,
  kettle: Coffee,
  bath: Bath,
  towels: Droplets,
  hairdryer: Wind,
  toiletries: Sparkles,
  bathrobes: Shirt,
  stove: CookingPot,
  dishes: UtensilsCrossed,
  coffee: Coffee,
  double_bed: BedDouble,
  separate_beds: Bed,
  sofa_bed: Sofa,
  grill: ChefHat,
  outdoor_furniture: Armchair,
  kids_area: Baby,
  private_area: LandPlot,
  pets_possible: PawPrint,
  self_checkin: KeyRound,
  quiet_hours: Moon,
  no_smoking_inside: CigaretteOff,
  extra_blankets: Layers,
  washing_machine: WashingMachine,
};

const POPULAR_AMENITY_IDS = new Set<string>(POPULAR_AMENITIES);

const ONBOARDING_AMENITY_GROUPS = AMENITIES_CATEGORIES.map((category) => ({
  id: category.id,
  title: category.title,
  itemIds: category.items
    .map((item) => item.id)
    .filter((id): id is (typeof POPULAR_AMENITIES)[number] =>
      POPULAR_AMENITY_IDS.has(id)
    ),
})).filter((group) => group.itemIds.length > 0);

function flattenAmenitiesLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const category of AMENITIES_CATEGORIES) {
    for (const item of category.items) {
      labels[item.id] = item.label;
    }
  }
  return labels;
}

function getFirstPendingStepId(settings: AdminSettingsPayload, tenantName?: string | null) {
  const progress = computeOnboardingProgress({ settings, tenantName });
  return progress.steps.find((step) => step.status !== "complete")?.id ?? null;
}

function Spinner() {
  return (
    <svg className="khata-onboarding__spinner" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 9 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function OnboardingWidget({
  settings,
  tenantName,
  onSettingsChange,
  onLogoPreviewChange,
}: OnboardingWidgetProps) {
  const amenityLabels = useMemo(() => flattenAmenitiesLabels(), []);
  const progress = useMemo(
    () => computeOnboardingProgress({ settings, tenantName }),
    [settings, tenantName]
  );
  const firstRoom = settings.roomsList?.[0];
  const firstPendingStep = useMemo(
    () => progress.steps.find((step) => step.status !== "complete")?.id ?? null,
    [progress.steps]
  );

  const [expanded, setExpanded] = useState(false);
  const [activeStepId, setActiveStepId] = useState<OnboardingStepId | null>(firstPendingStep);
  const [savingStep, setSavingStep] = useState<OnboardingStepId | null>(null);
  const [barPercent, setBarPercent] = useState(0);
  const [profileSiteTitle, setProfileSiteTitle] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const basicsDirtyRef = useRef(false);
  const amenitiesDirtyRef = useRef(false);
  const amenitiesRoomIdRef = useRef<number | string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCapacityInput, setNewRoomCapacityInput] = useState("2");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [priceWeekday, setPriceWeekday] = useState("");
  const [priceWeekend, setPriceWeekend] = useState("");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [objectPhotoPreviewUrls, setObjectPhotoPreviewUrls] = useState<string[]>([]);
  const [activePhotoPreviewUrl, setActivePhotoPreviewUrl] = useState<string | null>(null);
  const [isLogoProcessing, setIsLogoProcessing] = useState(false);
  const [isObjectPhotoProcessing, setIsObjectPhotoProcessing] = useState(false);
  const [flashStepId, setFlashStepId] = useState<OnboardingStepId | null>(null);
  const stepRefs = useRef<Partial<Record<OnboardingStepId, HTMLLIElement | null>>>({});
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const objectPhotoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setBarPercent(progress.percent));
    return () => cancelAnimationFrame(frame);
  }, [progress.percent]);

  useEffect(
    () => () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      for (const url of objectPhotoPreviewUrls) URL.revokeObjectURL(url);
    },
    [logoPreviewUrl, objectPhotoPreviewUrls]
  );

  const syncBasicsFormFromSettings = useCallback((source: AdminSettingsPayload) => {
    const branding = (source.branding || {}) as Record<string, unknown>;
    setProfileSiteTitle(String(branding.site_title ?? ""));
    setProfilePhone(String(branding.contact_phone || ""));
  }, []);

  useEffect(() => {
    if (basicsDirtyRef.current) return;
    syncBasicsFormFromSettings(settings);
  }, [settings, syncBasicsFormFromSettings]);

  useEffect(() => {
    const currentRoomId = firstRoom?.id ?? null;
    const roomChanged = amenitiesRoomIdRef.current !== currentRoomId;
    amenitiesRoomIdRef.current = currentRoomId;

    setNewRoomName("");
    setNewRoomCapacityInput(String(Math.max(1, Number(firstRoom?.capacity || 2))));
    setPriceWeekday(String(firstRoom?.priceWeekday || ""));
    setPriceWeekend(String(firstRoom?.priceWeekend || ""));

    if (amenitiesDirtyRef.current && !roomChanged) return;
    const activeAmenityIds: string[] = [];
    if (firstRoom?.amenities) {
      for (const items of Object.values(firstRoom.amenities)) {
        for (const item of items || []) {
          if (item.isActive) activeAmenityIds.push(item.id);
        }
      }
    }
    setSelectedAmenities(activeAmenityIds);
    if (roomChanged) amenitiesDirtyRef.current = false;
  }, [firstRoom]);

  useEffect(() => {
    if (!expanded || savingStep) return;
    setActiveStepId((prev) => {
      if (prev && progress.steps.some((s) => s.id === prev && s.status !== "complete")) return prev;
      return firstPendingStep;
    });
  }, [expanded, firstPendingStep, progress.steps, savingStep]);

  useEffect(() => {
    if (!expanded || !activeStepId) return;
    const node = stepRefs.current[activeStepId];
    if (!node) return;
    const timer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [activeStepId, expanded]);

  const handlePersistStep = async (stepId: OnboardingStepId, next: AdminSettingsPayload) => {
    setSavingStep(stepId);
    const saveKeys: Array<keyof AdminSettingsPayload> =
      stepId === "basics"
        ? ["branding"]
        : stepId === "prices"
          ? ["roomsList", "customPrices"]
          : ["roomsList"];
    try {
      await saveAdminSettings(next, { keys: saveKeys });
      onSettingsChange(next);
      const nextPending = getFirstPendingStepId(next, tenantName);
      setActiveStepId(nextPending);
      if (!nextPending) setExpanded(false);
      setFlashStepId(stepId);
      window.setTimeout(() => setFlashStepId((prev) => (prev === stepId ? null : prev)), 900);
      const successMap: Record<OnboardingStepId, string> = {
        basics: "Профіль збережено",
        first_room: "Котедж створено",
        amenities: "Зручності оновлено",
        prices: "Ціни встановлено",
      };
      showToast(successMap[stepId]);
    } catch (error) {
      console.error("[onboarding] step save:", error);
      showToast("Не вдалося зберегти. Спробуйте ще раз.");
    } finally {
      setSavingStep(null);
    }
  };

  const setNextLogoPreview = useCallback(
    (nextUrl: string | null) => {
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      onLogoPreviewChange?.(nextUrl);
    },
    [onLogoPreviewChange]
  );

  const handleLogoFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !file.type.startsWith("image/")) return;
      setIsLogoProcessing(true);
      try {
        const webpFile = await compressImageToWebp(file);
        const previewUrl = URL.createObjectURL(webpFile);
        setNextLogoPreview(previewUrl);
      } catch (error) {
        console.error("[onboarding] logo compress:", error);
        showToast("Не вдалося обробити лого");
      } finally {
        setIsLogoProcessing(false);
      }
    },
    [setNextLogoPreview]
  );

  const handleObjectPhotoFiles = useCallback(async (files: FileList | File[] | undefined) => {
    if (!files || files.length === 0) return;
    const currentCount = objectPhotoPreviewUrls.length;
    if (currentCount >= 15) {
      showToast("Можна завантажити максимум 15 фото");
      return;
    }
    const availableSlots = 15 - currentCount;
    const inputFiles = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, availableSlots);
    if (inputFiles.length === 0) return;
    setIsObjectPhotoProcessing(true);
    try {
      const webpFiles = await Promise.all(inputFiles.map((file) => compressImageToWebp(file)));
      const previewUrls = webpFiles.map((file) => URL.createObjectURL(file));
      setObjectPhotoPreviewUrls((prev) => {
        return [...prev, ...previewUrls].slice(0, 15);
      });
      if (currentCount + Array.from(files).length > 15) {
        showToast("Додано до ліміту: максимум 15 фото");
      }
    } catch (error) {
      console.error("[onboarding] photo compress:", error);
      showToast("Не вдалося обробити фото");
    } finally {
      setIsObjectPhotoProcessing(false);
    }
  }, [objectPhotoPreviewUrls.length]);

  const handleRemoveObjectPhoto = useCallback((index: number) => {
    setObjectPhotoPreviewUrls((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  }, []);

  const openObjectPhotoPicker = useCallback(() => {
    objectPhotoInputRef.current?.click();
  }, []);

  const handleSaveBasics = async () => {
    if (!profileSiteTitle.trim()) {
      showToast("Вкажіть назву об'єкта");
      return;
    }
    const phoneParts = parseStoredGuestPhone(profilePhone);
    if (!isValidGuestPhone(phoneParts.iso, phoneParts.dial, phoneParts.national)) {
      showToast("Вкажіть коректний номер телефону для гостей");
      return;
    }
    const branding = (settings.branding || {}) as Record<string, unknown>;
    const next: AdminSettingsPayload = {
      ...settings,
      branding: {
        ...branding,
        site_title: profileSiteTitle.trim(),
        contact_phone: formatGuestPhoneForSave(
          phoneParts.iso,
          phoneParts.dial,
          phoneParts.national
        ),
      },
    };
    await handlePersistStep("basics", next);
    basicsDirtyRef.current = false;
    syncBasicsFormFromSettings(next);
  };

  const handleCreateFirstRoom = async () => {
    const roomNameInput = newRoomName.trim();
    if (!roomNameInput) {
      showToast("Вкажіть назву котеджу");
      return;
    }
    const existingRooms = settings.roomsList || [];
    const maxId = existingRooms.reduce((acc, room) => Math.max(acc, Number(room.id) || 0), 0);
    const roomName = roomNameInput;
    const capacity = Math.max(1, Number(newRoomCapacityInput) || 2);
    const room: RoomConfig = {
      id: maxId + 1,
      name: roomName,
      short: roomName,
      desc: "",
      capacity,
      maxCapacity: Math.max(capacity, capacity + 2),
      extraGuestPrice: 2500,
      priceWeekday: 0,
      priceWeekend: 0,
      active: true,
      photos: [],
      detailedDescription: "",
      rules: {
        checkInTime: "15:00",
        checkOutTime: "11:00",
        pets: { isPetsFriendly: false, description: "За узгодженням" },
        selfCheckIn: { enabled: false, description: "" },
      },
      amenities: buildDefaultAmenitiesState(),
    };
    const next: AdminSettingsPayload = {
      ...settings,
      roomsList: [...existingRooms, room],
    };
    await handlePersistStep("first_room", next);
  };

  const handleSaveAmenities = async () => {
    if (!firstRoom) {
      showToast("Спочатку створіть котедж");
      return;
    }
    if (selectedAmenities.length === 0) {
      showToast("Оберіть хоча б одну зручність");
      return;
    }
    const defaults = buildDefaultAmenitiesState();
    const selectedSet = new Set(selectedAmenities);
    const currentAmenities = firstRoom.amenities || {};
    for (const [categoryId, items] of Object.entries(defaults)) {
      const currentById = new Map((currentAmenities[categoryId] || []).map((item) => [item.id, item]));
      defaults[categoryId] = items.map((item) => ({
        ...item,
        ...(currentById.get(item.id) || {}),
        isActive: selectedSet.has(item.id),
      }));
    }
    const nextRooms = (settings.roomsList || []).map((room) =>
      room.id === firstRoom.id ? { ...room, amenities: defaults } : room
    );
    await handlePersistStep("amenities", { ...settings, roomsList: nextRooms });
    amenitiesDirtyRef.current = false;
  };

  const handleSavePrices = async () => {
    if (!firstRoom) {
      showToast("Спочатку створіть котедж");
      return;
    }
    const weekday = Math.max(0, Number(priceWeekday) || 0);
    const weekend = Math.max(0, Number(priceWeekend) || 0);
    if (weekday <= 0 || weekend <= 0) {
      showToast("Вкажіть ціни на будні та вихідні");
      return;
    }
    const nextRooms = (settings.roomsList || []).map((room) =>
      room.id === firstRoom.id ? { ...room, priceWeekday: weekday, priceWeekend: weekend } : room
    );
    await handlePersistStep("prices", { ...settings, roomsList: nextRooms });
  };

  const toggleAmenity = (amenityId: string) => {
    amenitiesDirtyRef.current = true;
    setSelectedAmenities((prev) =>
      prev.includes(amenityId) ? prev.filter((item) => item !== amenityId) : [...prev, amenityId]
    );
  };

  const changeCapacity = (delta: number) => {
    const current = Math.max(1, Number(newRoomCapacityInput) || 1);
    const next = Math.min(30, Math.max(1, current + delta));
    setNewRoomCapacityInput(String(next));
  };

  const sectionExpanded = expanded ? "true" : "false";
  const firstPendingIndex = progress.steps.findIndex((step) => step.status !== "complete");
  const onboardingCtaLabel =
    progress.percent <= 0
      ? "Почати налаштування"
      : progress.isComplete
        ? "Готово"
        : "Продовжити налаштування";

  return (
    <section
      className="khata-onboarding bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
      aria-label="Швидкий старт"
      data-expanded={sectionExpanded}
    >
      <div className="khata-onboarding__inner">
        <div
          className="flex items-center justify-between gap-6 p-5 bg-[#f4f6f0]/70 cursor-pointer"
          onClick={() => setExpanded((prev) => !prev)}
          role="button"
          aria-expanded={expanded}
          aria-controls="khata-onboarding-accordion"
        >
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-[#eef3e3] flex items-center justify-center">
              <KhataBrandIcon className="w-8 h-8 text-[#5f7438]" />
            </div>
            <h2 className="text-xl font-bold text-[#3f4f24] tracking-tight leading-none">
              ЗАПУСК ХАТИ
              <span className="ml-2 font-bold text-[#3f4f24]">• {progress.percent}%</span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="btn-primary"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              aria-expanded={expanded}
              aria-controls="khata-onboarding-accordion"
            >
              {onboardingCtaLabel}
              <ChevronDown className={`w-4 h-4 transition-transform duration-200${expanded ? " rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        <div
          className="h-1.5 w-full bg-slate-100"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Прогрес онбордингу"
        >
          <div
            className="h-full bg-gradient-to-r from-[#6f8b45] to-[#5d7737] transition-all duration-500"
            style={{ width: `${barPercent}%` }}
          />
        </div>

        <div
          id="khata-onboarding-accordion"
          className={`khata-onboarding__accordion${expanded ? " is-open" : ""}`}
        >
          <ol className="khata-onboarding__steps">
            {progress.steps.map((step, index) => {
            const complete = step.status === "complete";
            const locked = !complete && firstPendingIndex >= 0 && index > firstPendingIndex;
            const open = !complete && activeStepId === step.id;
            return (
              <li
                key={step.id}
                ref={(node) => {
                  stepRefs.current[step.id] = node;
                }}
                className={`khata-onboarding__step khata-onboarding__step--${step.status}${open ? " is-open" : ""}${flashStepId === step.id ? " is-success-flash" : ""}${locked ? " is-locked" : ""}`}
              >
                <button
                  type="button"
                  className="khata-onboarding__step-head"
                  onClick={() => {
                    if (complete || locked) return;
                    setActiveStepId((prev) => (prev === step.id ? null : step.id));
                  }}
                  disabled={Boolean(savingStep) || locked}
                  aria-expanded={open}
                  >
                  <div className={`khata-onboarding__step-icon khata-onboarding__step-icon--${step.status}`} aria-hidden>
                    {complete ? <CheckIcon /> : <span>{index + 1}</span>}
                  </div>
                  <div className="khata-onboarding__step-body">
                    <p className={`khata-onboarding__step-title${complete ? " khata-onboarding__step-title--complete" : ""}`}>
                      {step.title}
                    </p>
                  <p className="khata-onboarding__step-desc">{step.description}</p>
                  </div>
                  {!complete ? (
                    <span className="khata-onboarding__step-expand">{locked ? "Завершіть попередній" : step.actionLabel}</span>
                  ) : null}
                </button>
                <div className={`khata-onboarding__step-panel${open ? " is-open" : ""}`}>
                  <div className="khata-onboarding__step-panel-inner">
                    {step.id === "basics" ? (
                      <div className="khata-onboarding__form-grid">
                        <label>
                          Назва на сайті
                          <input
                            value={profileSiteTitle}
                            onChange={(event) => {
                              basicsDirtyRef.current = true;
                              setProfileSiteTitle(event.target.value);
                            }}
                            placeholder="Назва комплексу"
                          />
                        </label>
                        <label>
                          Телефон для гостей
                          <GuestPhoneField
                            value={profilePhone}
                            onChange={(next) => {
                              basicsDirtyRef.current = true;
                              setProfilePhone(next);
                            }}
                            disabled={savingStep === "basics"}
                          />
                        </label>
                        <div className="khata-onboarding__media-col">
                          <span>Лого</span>
                          <label
                            className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-olive-400 overflow-hidden relative bg-white"
                            title="Завантажити лого"
                          >
                            <input
                              ref={logoInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={isLogoProcessing}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                void handleLogoFile(file);
                                event.currentTarget.value = "";
                              }}
                            />
                            {logoPreviewUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={logoPreviewUrl} alt="Лого" className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center gap-1 text-slate-500">
                                <ImagePlus className="w-4 h-4" />
                                <span className="text-[10px]">Лого</span>
                              </div>
                            )}
                            {isLogoProcessing ? (
                              <span className="absolute inset-0 bg-white/70 flex items-center justify-center text-[10px] text-slate-600">
                                WebP...
                              </span>
                            ) : null}
                          </label>
                        </div>
                        <div className="khata-onboarding__actions">
                          <button
                            type="button"
                            className="khata-onboarding__submit"
                            onClick={() => void handleSaveBasics()}
                            disabled={savingStep === "basics"}
                          >
                            {savingStep === "basics" ? <Spinner /> : null}
                            Зберегти
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {step.id === "first_room" ? (
                      <div className="khata-onboarding__form-grid">
                        <label>
                          Назва котеджу
                          <input
                            value={newRoomName}
                            onChange={(event) => setNewRoomName(event.target.value)}
                            placeholder="Котедж 1"
                          />
                        </label>
                        <label>
                          Базова місткість
                          <div className="khata-onboarding__capacity-wrap">
                            <button
                              type="button"
                              className="khata-onboarding__capacity-btn"
                              onClick={() => changeCapacity(-1)}
                              aria-label="Зменшити місткість"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={newRoomCapacityInput}
                              onChange={(event) => setNewRoomCapacityInput(event.target.value)}
                            />
                            <button
                              type="button"
                              className="khata-onboarding__capacity-btn"
                              onClick={() => changeCapacity(1)}
                              aria-label="Збільшити місткість"
                            >
                              +
                            </button>
                          </div>
                        </label>
                        <div
                          className="w-full h-32 mt-4 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-olive-400 overflow-hidden relative bg-white khata-onboarding__media-drop"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            void handleObjectPhotoFiles(event.dataTransfer.files);
                          }}
                        >
                          <input
                            ref={objectPhotoInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={isObjectPhotoProcessing}
                            onChange={(event) => {
                              void handleObjectPhotoFiles(event.target.files || undefined);
                              event.currentTarget.value = "";
                            }}
                          />
                          {objectPhotoPreviewUrls.length > 0 ? (
                            <>
                              <div className="khata-onboarding__media-grid">
                                {objectPhotoPreviewUrls.length < 15 ? (
                                  <button
                                    type="button"
                                    className="khata-onboarding__media-add-tile"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      openObjectPhotoPicker();
                                    }}
                                  >
                                    <UploadCloud className="w-4 h-4" />
                                    <span>Додати ще</span>
                                  </button>
                                ) : null}
                                {objectPhotoPreviewUrls.map((url, idx) => (
                                  <div key={url} className="khata-onboarding__media-item">
                                    <button
                                      type="button"
                                      className="block w-full h-full"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setActivePhotoPreviewUrl(url);
                                      }}
                                      aria-label={`Відкрити фото ${idx + 1}`}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={url}
                                        alt={`Фото об'єкта ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      className="khata-onboarding__media-remove"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        handleRemoveObjectPhoto(idx);
                                      }}
                                      aria-label={`Видалити фото ${idx + 1}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <span className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/55 text-white text-[10px] font-semibold">
                                {objectPhotoPreviewUrls.length}/15
                              </span>
                            </>
                          ) : isObjectPhotoProcessing ? null : (
                            <button
                              type="button"
                              className="flex flex-col items-center gap-2 text-slate-500"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openObjectPhotoPicker();
                              }}
                            >
                              <UploadCloud className="w-5 h-5" />
                              <span className="text-xs">Завантажити фото об'єкта (до 15)</span>
                            </button>
                          )}
                          {isObjectPhotoProcessing ? (
                            <span className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center text-xs text-slate-600 gap-2">
                              <span className="khata-onboarding__media-loading-dot" aria-hidden />
                              Завантаження...
                            </span>
                          ) : null}
                        </div>
                        <div className="khata-onboarding__actions">
                          <button
                            type="button"
                            className="khata-onboarding__submit"
                            onClick={() => void handleCreateFirstRoom()}
                            disabled={savingStep === "first_room"}
                          >
                            {savingStep === "first_room" ? <Spinner /> : null}
                            Зберегти
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {step.id === "amenities" ? (
                      <>
                        <div className="khata-onboarding__amenity-groups">
                          {ONBOARDING_AMENITY_GROUPS.map((group) => (
                            <section key={group.id} className="khata-onboarding__amenity-group">
                              <h4 className="khata-onboarding__amenity-group-title">{group.title}</h4>
                              <div className="khata-onboarding__amenity-grid">
                                {group.itemIds.map((amenityId) => {
                                  const Icon = AMENITY_ICONS[amenityId];
                                  return (
                                    <button
                                      key={amenityId}
                                      type="button"
                                      className={`khata-onboarding__amenity-card flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50${selectedAmenities.includes(amenityId) ? " is-active" : ""}`}
                                      onClick={() => toggleAmenity(amenityId)}
                                    >
                                      <Icon className="h-[18px] w-[18px] text-slate-500 shrink-0" />
                                      <span className="khata-onboarding__amenity-check" aria-hidden>
                                        {selectedAmenities.includes(amenityId) ? "✓" : ""}
                                      </span>
                                      <span>{amenityLabels[amenityId] || amenityId}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </section>
                          ))}
                        </div>
                        <div className="khata-onboarding__actions">
                          <button
                            type="button"
                            className="khata-onboarding__submit"
                            onClick={() => void handleSaveAmenities()}
                            disabled={!firstRoom || savingStep === "amenities"}
                          >
                            {savingStep === "amenities" ? <Spinner /> : null}
                            Зберегти
                          </button>
                        </div>
                      </>
                    ) : null}

                    {step.id === "prices" ? (
                      <div className="khata-onboarding__form-grid">
                        <label>
                          <span className="inline-flex items-center gap-1.5">
                            <Wallet className="h-3.5 w-3.5 text-slate-400" />
                            Ціна (будні)
                          </span>
                          <div className="khata-onboarding__price-input-wrap">
                            <span className="khata-onboarding__currency-prefix">₴</span>
                            <input
                              type="number"
                              min={0}
                              value={priceWeekday}
                              onChange={(event) => setPriceWeekday(event.target.value)}
                              placeholder="0"
                              className="khata-onboarding__price-input"
                            />
                          </div>
                        </label>
                        <label>
                          <span className="inline-flex items-center gap-1.5">
                            <Wallet className="h-3.5 w-3.5 text-slate-400" />
                            Ціна (вихідні)
                          </span>
                          <div className="khata-onboarding__price-input-wrap">
                            <span className="khata-onboarding__currency-prefix">₴</span>
                            <input
                              type="number"
                              min={0}
                              value={priceWeekend}
                              onChange={(event) => setPriceWeekend(event.target.value)}
                              placeholder="0"
                              className="khata-onboarding__price-input"
                            />
                          </div>
                        </label>
                        <div className="khata-onboarding__actions">
                          <button
                            type="button"
                            className="khata-onboarding__submit"
                            onClick={() => void handleSavePrices()}
                            disabled={!firstRoom || savingStep === "prices"}
                          >
                            {savingStep === "prices" ? <Spinner /> : null}
                            Зберегти
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
            })}
          </ol>
        </div>
      </div>
      {activePhotoPreviewUrl ? (
        <div
          className="khata-onboarding__photo-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Перегляд фото"
          onClick={() => setActivePhotoPreviewUrl(null)}
        >
          <div className="khata-onboarding__photo-modal-inner" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="khata-onboarding__photo-modal-close"
              aria-label="Закрити перегляд"
              onClick={() => setActivePhotoPreviewUrl(null)}
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePhotoPreviewUrl}
              alt="Фото об'єкта"
              className="khata-onboarding__photo-modal-image"
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
