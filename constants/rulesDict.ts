export type RuleDictItem = {
  id: string;
  label: string;
};

export type RuleDictCategory = {
  id: string;
  title: string;
  items: RuleDictItem[];
};

/** Окремий словник правил для житла (не змішувати зі зручностями). */
export const RULES_CATEGORIES: RuleDictCategory[] = [
  {
    id: "quiet",
    title: "Тиша та порядок",
    items: [
      { id: "quiet_hours_22_08", label: "Режим тиші 22:00 – 08:00" },
      { id: "no_parties", label: "Заборонені вечірки та гучна музика" },
      { id: "no_stag_parties", label: "Без «мальчишників» та «дівичників»" },
      { id: "shoes_off", label: "Знімати взуття в будинку" },
      { id: "trash_separate", label: "Сортування сміття" },
      { id: "energy_save", label: "Бережливе використання електрики та води" },
    ],
  },
  {
    id: "smoking",
    title: "Куріння та алкоголь",
    items: [
      { id: "no_smoking_inside", label: "Куріння лише на вулиці" },
      { id: "no_smoking_property", label: "Повна заборона куріння на території" },
      { id: "no_alcohol_excess", label: "Прохання не зловживати алкоголем" },
    ],
  },
  {
    id: "guests",
    title: "Гості та діти",
    items: [
      { id: "max_guests_only", label: "Кількість гостей лише за бронюванням" },
      { id: "no_unregistered_guests", label: "Гості без реєстрації заборонені" },
      { id: "children_supervised", label: "Діти лише під наглядом дорослих" },
      { id: "infants_welcome", label: "Малюки вітаються" },
      { id: "extra_beds_fee", label: "Додаткові місця — за домовленістю" },
    ],
  },
  {
    id: "pets",
    title: "Тварини",
    items: [
      { id: "pets_by_agreement", label: "Тварини за попередньою домовленістю" },
      { id: "no_pets", label: "Без тварин" },
      { id: "pets_small_only", label: "Лише дрібні тварини" },
      { id: "pets_fee", label: "Тварини за додаткову оплату" },
      { id: "pets_clean", label: "Прибирати за твариною на території" },
    ],
  },
  {
    id: "checkin",
    title: "Заїзд та виїзд",
    items: [
      { id: "self_checkin", label: "Самостійне заселення" },
      { id: "contactless_checkin", label: "Бесконтактне заселення" },
      { id: "id_required", label: "Документ при заселенні" },
      { id: "deposit_required", label: "Депозит при заїзді" },
      { id: "checkout_clean", label: "Прибирати посуд і сміття перед виїздом" },
      { id: "checkout_lights", label: "Вимкнути світло та техніку при виїзді" },
    ],
  },
  {
    id: "territory",
    title: "Територія та безпека",
    items: [
      { id: "parking_on_site", label: "Паркування на території" },
      { id: "gate_code", label: "Код від воріт перед заїздом" },
      { id: "no_outdoor_fires", label: "Заборона розводити вогнища" },
      { id: "bbq_rules", label: "BBQ лише у виділених зонах" },
      { id: "pool_rules", label: "Басейн — за правилами комплексу" },
      { id: "hot_tub_rules", label: "Чан / джакузі — за правилами комплексу" },
      { id: "no_fireworks", label: "Без феєрверків та піротехніки" },
      { id: "damage_report", label: "Повідомляти про пошкодження одразу" },
    ],
  },
];

export const HOUSE_RULES_CATEGORY_ID = "house_rules";

/** Мапінг застарілих id з категорії «rules» у зручностях. */
export const LEGACY_RULE_ID_MAP: Record<string, string> = {
  pets_possible: "pets_by_agreement",
  quiet_hours: "quiet_hours_22_08",
  self_checkin: "self_checkin",
  no_smoking_inside: "no_smoking_inside",
};

export function buildDefaultHouseRulesState(): Record<
  string,
  { id: string; isActive: boolean; isFeatured: boolean; customText?: string }[]
> {
  return {
    [HOUSE_RULES_CATEGORY_ID]: RULES_CATEGORIES.flatMap((cat) =>
      cat.items.map((it) => ({
        id: it.id,
        isActive: false,
        isFeatured: false,
      }))
    ),
  };
}

export function getAllRuleIds(): string[] {
  return RULES_CATEGORIES.flatMap((c) => c.items.map((i) => i.id));
}
