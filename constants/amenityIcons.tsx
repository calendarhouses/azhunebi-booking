import type { LucideIcon } from "lucide-react";
import {
  AirVent,
  Baby,
  Ban,
  Bath,
  Bed,
  BedDouble,
  Car,
  ChefHat,
  CigaretteOff,
  Coffee,
  Croissant,
  Droplets,
  Fence,
  Flame,
  KeyRound,
  Laptop,
  Microwave,
  Moon,
  Mountain,
  PawPrint,
  Refrigerator,
  Shirt,
  ShowerHead,
  Sofa,
  Sparkles,
  Sun,
  Trees,
  Tv,
  UtensilsCrossed,
  WashingMachine,
  Waves,
  Wifi,
  Wind,
} from "lucide-react";
import { AMENITIES_CATEGORIES } from "./amenitiesDict";

const AMENITY_LUCIDE_MAP: Record<string, LucideIcon> = {
  lake_view: Waves,
  forest_view: Trees,
  terrace: Sun,
  private_area: Fence,
  towels: Sparkles,
  hairdryer: Wind,
  shower: ShowerHead,
  bath: Bath,
  bathrobes: Shirt,
  toiletries: Droplets,
  stove: ChefHat,
  fridge: Refrigerator,
  kettle: Coffee,
  microwave: Microwave,
  dishes: UtensilsCrossed,
  coffee: Coffee,
  breakfast: Croissant,
  double_bed: BedDouble,
  separate_beds: Bed,
  sofa_bed: Sofa,
  extra_blankets: BedDouble,
  wifi: Wifi,
  ac: AirVent,
  heating: Flame,
  tv: Tv,
  fireplace: Flame,
  washing_machine: WashingMachine,
  iron: Shirt,
  workspace: Laptop,
  bbq: Flame,
  grill: Flame,
  outdoor_furniture: Sofa,
  parking: Car,
  kids_area: Baby,
  vat: Bath,
  pool: Waves,
  sauna: Droplets,
  pets_possible: PawPrint,
  no_smoking_inside: CigaretteOff,
  quiet_hours: Moon,
  self_checkin: KeyRound,
};

const CATEGORY_LUCIDE_MAP: Record<string, LucideIcon> = {
  view: Mountain,
  bathroom: Bath,
  kitchen: ChefHat,
  bedroom: BedDouble,
  comfort: Wifi,
  outdoor: Trees,
  spa: Bath,
  rules: Moon,
};

const KNOWN_AMENITY_IDS = new Set(
  AMENITIES_CATEGORIES.flatMap((category) => category.items.map((item) => item.id))
);

const MISSING_AMENITY_ICON_IDS = [...KNOWN_AMENITY_IDS].filter((id) => !(id in AMENITY_LUCIDE_MAP));
if (MISSING_AMENITY_ICON_IDS.length > 0) {
  throw new Error(`Missing amenity icons for ids: ${MISSING_AMENITY_ICON_IDS.join(", ")}`);
}

const AMENITY_ICON_CLASS = "w-5 h-5 shrink-0";
const AMENITY_STROKE = 1.5;

export function AmenityIcon({
  id,
  className,
  active = false,
}: {
  id: string;
  className?: string;
  active?: boolean;
}) {
  const Icon = AMENITY_LUCIDE_MAP[id];
  if (!Icon) return null;
  const colorClass = active ? "text-olive-700" : "text-stone-400";
  return (
    <Icon
      className={[AMENITY_ICON_CLASS, colorClass, className].filter(Boolean).join(" ")}
      size={20}
      strokeWidth={AMENITY_STROKE}
      aria-hidden
    />
  );
}

export function AmenityCategoryIcon({
  categoryId,
  className,
}: {
  categoryId: string;
  className?: string;
}) {
  const Icon = CATEGORY_LUCIDE_MAP[categoryId];
  if (!Icon) return null;
  return (
    <Icon
      className={[AMENITY_ICON_CLASS, "text-olive-700", className].filter(Boolean).join(" ")}
      size={20}
      strokeWidth={AMENITY_STROKE}
      aria-hidden
    />
  );
}
