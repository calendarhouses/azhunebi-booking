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
  Coffee,
  Croissant,
  Droplets,
  Fence,
  Flame,
  Laptop,
  Microwave,
  Mountain,
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
};

const CATEGORY_LUCIDE_MAP: Record<string, LucideIcon> = {
  view: Mountain,
  bathroom: Bath,
  kitchen: ChefHat,
  bedroom: BedDouble,
  comfort: Wifi,
  outdoor: Trees,
  spa: Bath,
};

const ICON_SIZE = 20;
const ICON_STROKE = 1.5;

export function PublicAmenityIcon({ id }: { id: string }) {
  const Icon = AMENITY_LUCIDE_MAP[id] ?? Ban;
  return (
    <Icon
      className="public-amenity-icon"
      size={ICON_SIZE}
      strokeWidth={ICON_STROKE}
      aria-hidden
    />
  );
}

export function PublicAmenityCategoryIcon({ categoryId }: { categoryId: string }) {
  const Icon = CATEGORY_LUCIDE_MAP[categoryId] ?? Sparkles;
  return (
    <Icon
      className="public-amenity-icon public-amenity-icon--category"
      size={ICON_SIZE}
      strokeWidth={ICON_STROKE}
      aria-hidden
    />
  );
}
