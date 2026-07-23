export type AmenityDictItem = {
  id: string;
  label: string;
};

export type AmenityDictCategory = {
  id: string;
  title: string;
  items: AmenityDictItem[];
};

export const AMENITIES_CATEGORIES: AmenityDictCategory[] = [
  {
    id: "view",
    title: "Вид / Локація",
    items: [
      { id: "lake_view", label: "Вид на гори" },
      { id: "forest_view", label: "Вид на ліс" },
      { id: "terrace", label: "Тераса" },
      { id: "private_area", label: "Окрема приватна територія" },
    ],
  },
  {
    id: "bathroom",
    title: "Ванна кімната",
    items: [
      { id: "towels", label: "Рушники" },
      { id: "hairdryer", label: "Фен" },
      { id: "shower", label: "Душ" },
      { id: "bath", label: "Ванна" },
      { id: "bathrobes", label: "Халати" },
      { id: "toiletries", label: "Косметика / туалетне приладдя" },
    ],
  },
  {
    id: "kitchen",
    title: "Кухня",
    items: [
      { id: "stove", label: "Плита" },
      { id: "fridge", label: "Холодильник" },
      { id: "kettle", label: "Електрочайник" },
      { id: "microwave", label: "Мікрохвильова піч" },
      { id: "dishes", label: "Посуд та прибори" },
      { id: "coffee", label: "Кава / чай" },
      { id: "breakfast", label: "Сніданок" },
    ],
  },
  {
    id: "bedroom",
    title: "Спальня",
    items: [
      { id: "double_bed", label: "Двоспальне ліжко" },
      { id: "separate_beds", label: "Окремі ліжка" },
      { id: "sofa_bed", label: "Розкладний диван" },
      { id: "extra_blankets", label: "Додаткові ковдри" },
    ],
  },
  {
    id: "comfort",
    title: "Комфорт",
    items: [
      { id: "wifi", label: "Wi‑Fi" },
      { id: "ac", label: "Кондиціонер" },
      { id: "heating", label: "Опалення" },
      { id: "tv", label: "Телевізор" },
      { id: "fireplace", label: "Камін" },
      { id: "washing_machine", label: "Пральна машина" },
      { id: "iron", label: "Праска" },
      { id: "workspace", label: "Робочий стіл / Wi‑Fi зона" },
    ],
  },
  {
    id: "outdoor",
    title: "На вулиці",
    items: [
      { id: "bbq", label: "BBQ‑зона / мангал" },
      { id: "grill", label: "Гриль" },
      { id: "outdoor_furniture", label: "Вуличні меблі" },
      { id: "parking", label: "Паркування" },
      { id: "kids_area", label: "Дитяча зона" },
    ],
  },
  {
    id: "spa",
    title: "Спа",
    items: [
      { id: "vat", label: "Чан" },
      { id: "pool", label: "Басейн" },
      { id: "sauna", label: "Сауна" },
    ],
  },
];

export function buildDefaultAmenitiesState(): Record<string, { id: string; isActive: boolean; isFeatured: boolean; customText?: string }[]> {
  const next: Record<
    string,
    { id: string; isActive: boolean; isFeatured: boolean; customText?: string }[]
  > = {};
  for (const cat of AMENITIES_CATEGORIES) {
    next[cat.id] = cat.items.map((it) => ({
      id: it.id,
      isActive: false,
      isFeatured: false,
    }));
  }
  return next;
}

