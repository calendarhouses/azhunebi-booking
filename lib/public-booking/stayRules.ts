/** House rules shown before final booking confirmation. */

export type StayRulesSection = {
  id: string;
  title: string;
  /** Rule lines shown as cards under the section title. */
  items: string[];
};

export type StayRulesContent = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: StayRulesSection[];
};

export const STAY_RULES_EYEBROW = "Внутрішні правила";
export const STAY_RULES_TITLE = "Спокійний відпочинок";
export const STAY_RULES_INTRO =
  "У нашому глемпінгу — спокійний відпочинок. Проживаючи у нас, потрібно дотримуватися внутрішніх правил. Можливо, вони вам не підійдуть — і ви передумаєте бронювати.";
export const STAY_RULES_PROHIBITIONS_LABEL = "У нас не можна";
export const STAY_RULES_PROHIBITIONS: string[] = [
  "гучні застілля",
  "слухати музику через колонку або телефон",
  "проживання з тваринами",
  "палити в будиночку та на території, окрім відведених місць",
  "вживати напої та їжу в басейні",
  "залишати бруд та брудний посуд на території та на кухні самообслуговування",
  "порушувати режим тиші",
  "вживати міцний алкоголь",
  "використовувати нецензурну лексику",
];

export const DEFAULT_STAY_RULES: StayRulesContent = {
  eyebrow: STAY_RULES_EYEBROW,
  title: STAY_RULES_TITLE,
  intro: STAY_RULES_INTRO,
  sections: [
    {
      id: "prohibitions",
      title: STAY_RULES_PROHIBITIONS_LABEL,
      items: [...STAY_RULES_PROHIBITIONS],
    },
  ],
};

export type StayRulesBrandingInput = {
  stay_rules?: unknown;
  [key: string]: unknown;
};

function newSectionId(): string {
  return `sr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyStayRulesSection(
  title = "Новий розділ"
): StayRulesSection {
  return {
    id: newSectionId(),
    title,
    items: [""],
  };
}

function normalizeItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeSections(raw: unknown): StayRulesSection[] {
  if (!Array.isArray(raw)) return [];
  const out: StayRulesSection[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const title = String(row.title ?? "").trim();
    const items = normalizeItems(row.items);
    if (!title && items.length === 0) continue;
    out.push({
      id: String(row.id || newSectionId()),
      title: title || "Правила",
      items,
    });
  }
  return out;
}

/** Resolve public stay-rules from branding, falling back to defaults. */
export function resolveStayRules(
  branding?: StayRulesBrandingInput | null
): StayRulesContent {
  const raw = branding?.stay_rules;
  if (!raw || typeof raw !== "object") {
    return {
      eyebrow: DEFAULT_STAY_RULES.eyebrow,
      title: DEFAULT_STAY_RULES.title,
      intro: DEFAULT_STAY_RULES.intro,
      sections: DEFAULT_STAY_RULES.sections.map((s) => ({
        ...s,
        items: [...s.items],
      })),
    };
  }

  const data = raw as Record<string, unknown>;
  const sections = normalizeSections(data.sections);
  const eyebrow = String(data.eyebrow ?? "").trim() || DEFAULT_STAY_RULES.eyebrow;
  const title = String(data.title ?? "").trim() || DEFAULT_STAY_RULES.title;
  const intro = String(data.intro ?? "").trim() || DEFAULT_STAY_RULES.intro;

  // Legacy shape: single prohibitions list without sections
  if (!sections.length) {
    const legacyItems = normalizeItems(data.prohibitions || data.items);
    if (legacyItems.length) {
      return {
        eyebrow,
        title,
        intro,
        sections: [
          {
            id: "prohibitions",
            title:
              String(data.prohibitionsLabel || data.sectionTitle || "").trim() ||
              STAY_RULES_PROHIBITIONS_LABEL,
            items: legacyItems,
          },
        ],
      };
    }
    return {
      eyebrow,
      title,
      intro,
      sections: DEFAULT_STAY_RULES.sections.map((s) => ({
        ...s,
        items: [...s.items],
      })),
    };
  }

  return { eyebrow, title, intro, sections };
}

/** Persistable branding payload (empty lines stripped). */
export function serializeStayRulesForSave(
  content: StayRulesContent
): StayRulesContent {
  return {
    eyebrow: content.eyebrow.trim() || DEFAULT_STAY_RULES.eyebrow,
    title: content.title.trim() || DEFAULT_STAY_RULES.title,
    intro: content.intro.trim() || DEFAULT_STAY_RULES.intro,
    sections: content.sections
      .map((section) => ({
        id: section.id || newSectionId(),
        title: section.title.trim(),
        items: section.items.map((item) => item.trim()).filter(Boolean),
      }))
      .filter((section) => section.title || section.items.length > 0)
      .map((section) => ({
        ...section,
        title: section.title || "Правила",
      })),
  };
}

export function stayRulesSummaryLabel(content: StayRulesContent): string {
  const sections = content.sections.length;
  const items = content.sections.reduce((n, s) => n + s.items.length, 0);
  if (!sections) return "Немає розділів";
  const sectionWord =
    sections === 1 ? "розділ" : sections < 5 ? "розділи" : "розділів";
  return `${sections} ${sectionWord} · ${items} пунктів`;
}
