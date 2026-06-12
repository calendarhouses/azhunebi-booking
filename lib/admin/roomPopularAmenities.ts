import type { ComponentType } from "react";
import {
  Armchair,
  Baby,
  Bath,
  Bed,
  BedDouble,
  Car,
  ChefHat,
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
  WashingMachine,
  Waves,
  Wind,
  Wifi,
} from "lucide-react";
import { AMENITIES_CATEGORIES } from "@/constants/amenitiesDict";

export const POPULAR_AMENITIES = [
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

export type PopularAmenityId = (typeof POPULAR_AMENITIES)[number];

const POPULAR_SET = new Set<string>(POPULAR_AMENITIES);

export const POPULAR_AMENITY_ICONS: Record<PopularAmenityId, ComponentType<{ className?: string }>> = {
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

export const POPULAR_AMENITY_GROUPS = AMENITIES_CATEGORIES.map((category) => ({
  id: category.id,
  title: category.title,
  itemIds: category.items
    .map((item) => item.id)
    .filter((id): id is PopularAmenityId => POPULAR_SET.has(id)),
})).filter((group) => group.itemIds.length > 0);

export function flattenAmenityLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const category of AMENITIES_CATEGORIES) {
    for (const item of category.items) {
      labels[item.id] = item.label;
    }
  }
  return labels;
}
