import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Ban,
  Banknote,
  BellOff,
  CigaretteOff,
  Clock,
  CreditCard,
  Dog,
  Flame,
  Footprints,
  KeyRound,
  LightbulbOff,
  Lock,
  Moon,
  Music,
  PartyPopper,
  PawPrint,
  Recycle,
  Shield,
  Sparkles,
  Trash2,
  Trees,
  UserCheck,
  Users,
  VolumeX,
  Waves,
  Wine,
  Zap,
} from "lucide-react";
import { getAllRuleIds } from "./rulesDict";

const RULE_LUCIDE_MAP: Record<string, LucideIcon> = {
  quiet_hours_22_08: Moon,
  no_parties: VolumeX,
  no_stag_parties: PartyPopper,
  shoes_off: Footprints,
  trash_separate: Recycle,
  energy_save: Zap,
  no_smoking_inside: CigaretteOff,
  no_smoking_property: Ban,
  no_alcohol_excess: Wine,
  max_guests_only: Users,
  no_unregistered_guests: UserCheck,
  children_supervised: Baby,
  infants_welcome: Baby,
  extra_beds_fee: Banknote,
  pets_by_agreement: PawPrint,
  no_pets: Ban,
  pets_small_only: Dog,
  pets_fee: PawPrint,
  pets_clean: Sparkles,
  self_checkin: KeyRound,
  contactless_checkin: KeyRound,
  id_required: UserCheck,
  deposit_required: CreditCard,
  checkout_clean: Trash2,
  checkout_lights: LightbulbOff,
  parking_on_site: Trees,
  gate_code: Lock,
  no_outdoor_fires: Flame,
  bbq_rules: Flame,
  pool_rules: Waves,
  hot_tub_rules: Waves,
  no_fireworks: Sparkles,
  damage_report: Shield,
};


const ICON_CLASS = "w-5 h-5 shrink-0";
const STROKE = 1.5;

const missing = getAllRuleIds().filter((id) => !(id in RULE_LUCIDE_MAP));
if (missing.length) {
  throw new Error(`Missing rule icons: ${missing.join(", ")}`);
}

export function RuleIcon({
  id,
  className,
  active = false,
}: {
  id: string;
  className?: string;
  active?: boolean;
}) {
  const Icon = RULE_LUCIDE_MAP[id] ?? BellOff;
  const colorClass = active ? "text-olive-700" : "text-stone-400";
  return (
    <Icon
      className={[ICON_CLASS, colorClass, className].filter(Boolean).join(" ")}
      size={20}
      strokeWidth={STROKE}
      aria-hidden
    />
  );
}

export function RuleCategoryIcon({
  categoryId,
  className,
}: {
  categoryId: string;
  className?: string;
}) {
  const map: Record<string, LucideIcon> = {
    quiet: Moon,
    smoking: CigaretteOff,
    guests: Users,
    pets: PawPrint,
    checkin: Clock,
    territory: Trees,
  };
  const Icon = map[categoryId] ?? Shield;
  return (
    <Icon
      className={[ICON_CLASS, "text-olive-700", className].filter(Boolean).join(" ")}
      size={20}
      strokeWidth={STROKE}
      aria-hidden
    />
  );
}
