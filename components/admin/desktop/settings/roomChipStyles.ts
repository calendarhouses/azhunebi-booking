/** Спільні стилі плашки «Назва» — однакові в таблиці, статусі «Увімкнено» та popover */
export const ROOM_NAME_CHIP_CLASS =
  "inline-flex items-end gap-2 px-3 py-1.5 rounded-lg bg-[#EAF0E4] text-olive-800 border border-solid border-olive-400 hover:bg-[#DFE9D6] hover:border-olive-600 hover:text-olive-900 cursor-pointer transition-colors";

export const ROOM_CAPACITY_CHIP_CLASS =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-solid bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200 hover:border-stone-300 cursor-pointer transition-colors text-sm font-medium";

export const ROOM_ACTION_EDIT_CLASS =
  "p-1.5 rounded-md border border-solid border-stone-200 bg-white text-stone-400 hover:text-olive-700 hover:bg-[#F4F6F0] hover:border-olive-400 cursor-pointer transition-colors inline-flex items-center justify-center";

export const ROOM_ACTION_DELETE_CLASS =
  "p-1.5 rounded-md border border-solid border-stone-200 bg-white text-stone-400 hover:text-red-700 hover:bg-red-50 hover:border-red-200 cursor-pointer transition-colors inline-flex items-center justify-center";

export const ROOM_NAME_CHIP_ICON_CLASS = "text-olive-600 shrink-0 inline-flex w-3.5 h-3.5";

export const ROOM_NAME_CHIP_TABLE_TEXT = "text-sm font-semibold";

export const ROOM_NAME_CHIP_BADGE_TEXT = "text-xs font-semibold";

/** Popover «Назва» — ті самі кольори, що й плашка */
export const ROOM_NAME_POPOVER_INPUT_CLASS =
  "h-9 px-3 rounded-lg border border-olive-400 bg-[#EAF0E4] text-sm text-olive-800 placeholder:text-olive-600/50 focus:border-olive-600 focus:ring-1 focus:ring-olive-500 outline-none w-full";

export const ROOM_NAME_POPOVER_SAVE_CLASS = `${ROOM_NAME_CHIP_CLASS} ${ROOM_NAME_CHIP_TABLE_TEXT} self-end`;

/** Конструктор цін — неактивний чіп (як «В якій хаті діє?» у знижках) */
export const PRICE_CONSTRUCTOR_CHIP_IDLE_CLASS =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-800 cursor-pointer transition-colors text-sm font-medium";

/** Конструктор цін — активний чіп */
export const PRICE_CONSTRUCTOR_CHIP_ACTIVE_CLASS =
  "inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-[#5c6b4b] bg-[#5c6b4b]/5 text-[#5c6b4b] cursor-pointer transition-colors text-sm font-medium shadow-sm";

/** Кнопка «Зберегти ціни» */
export const PRICE_CONSTRUCTOR_SAVE_CLASS = `${ROOM_NAME_CHIP_CLASS} w-full justify-center py-3.5 text-sm font-semibold`;

/** Статус «Увімкнено» — ті самі кольори, що й плашка «Назва», але з центруванням крапки */
export const ROOM_ENABLED_BADGE_CLASS =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EAF0E4] text-olive-800 border border-solid border-olive-400 hover:bg-[#DFE9D6] hover:border-olive-600 hover:text-olive-900 cursor-pointer transition-colors text-xs font-semibold";

/** Статус «Вимкнено» — ледь червоний */
export const ROOM_DISABLED_BADGE_CLASS =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-solid bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 cursor-pointer transition-colors text-xs font-semibold";
