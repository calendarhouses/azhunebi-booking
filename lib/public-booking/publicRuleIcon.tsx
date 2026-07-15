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

const ICON_SIZE = 20;
const ICON_STROKE = 1.5;

export function PublicRuleIcon({ id }: { id: string }) {
  const Icon = RULE_LUCIDE_MAP[id] ?? BellOff;
  return (
    <Icon
      className="public-amenity-icon"
      size={ICON_SIZE}
      strokeWidth={ICON_STROKE}
      aria-hidden
    />
  );
}
