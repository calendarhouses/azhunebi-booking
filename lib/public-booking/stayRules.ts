/** House rules shown before final booking confirmation. */

/** Marker drawn next to every rule line. */
export type StayRuleMark = "cross" | "check" | "dash";

export const STAY_RULE_MARKS: { value: StayRuleMark; label: string }[] = [
  { value: "cross", label: "Заборона" },
  { value: "check", label: "Дозвіл" },
  { value: "dash", label: "Нейтрально" },
];

export type StayRulesSection = {
  id: string;
  title: string;
  /** Marker style for this section's lines. */
  icon: StayRuleMark;
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
      icon: "cross",
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

function cloneDefaultSections(): StayRulesSection[] {
  return DEFAULT_STAY_RULES.sections.map((s) => ({ ...s, items: [...s.items] }));
}

export function normalizeStayRuleMark(raw: unknown): StayRuleMark {
  const value = String(raw ?? "").trim();
  return value === "check" || value === "dash" ? value : "cross";
}

export function createEmptyStayRulesSection(
  title = "Новий розділ",
  icon: StayRuleMark = "cross"
): StayRulesSection {
  return { id: newSectionId(), title, icon, items: [""] };
}

/**
 * `preserveDrafts` keeps the admin editor usable: empty lines and untrimmed
 * input must survive re-renders, otherwise a freshly added blank rule would be
 * dropped the moment it appears. Public rendering uses the strict pass.
 */
function normalizeItems(raw: unknown, preserveDrafts: boolean): string[] {
  if (!Array.isArray(raw)) return [];
  const items = raw.map((item) => String(item ?? ""));
  return preserveDrafts ? items : items.map((item) => item.trim()).filter(Boolean);
}

function normalizeSections(raw: unknown, preserveDrafts: boolean): StayRulesSection[] {
  if (!Array.isArray(raw)) return [];
  const out: StayRulesSection[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const rawTitle = String(row.title ?? "");
    const title = preserveDrafts ? rawTitle : rawTitle.trim();
    const items = normalizeItems(row.items, preserveDrafts);
    if (!preserveDrafts && !title && items.length === 0) continue;
    out.push({
      id: String(row.id || newSectionId()),
      title: preserveDrafts ? title : title || "Правила",
      icon: normalizeStayRuleMark(row.icon),
      items,
    });
  }
  return out;
}

function resolveInternal(
  branding: StayRulesBrandingInput | null | undefined,
  preserveDrafts: boolean
): StayRulesContent {
  const raw = branding?.stay_rules;
  if (!raw || typeof raw !== "object") {
    return {
      eyebrow: DEFAULT_STAY_RULES.eyebrow,
      title: DEFAULT_STAY_RULES.title,
      intro: DEFAULT_STAY_RULES.intro,
      sections: cloneDefaultSections(),
    };
  }

  const data = raw as Record<string, unknown>;
  const text = (key: string, fallback: string) => {
    const value = String(data[key] ?? "");
    if (preserveDrafts) return data[key] == null ? fallback : value;
    return value.trim() || fallback;
  };
  const eyebrow = text("eyebrow", DEFAULT_STAY_RULES.eyebrow);
  const title = text("title", DEFAULT_STAY_RULES.title);
  const intro = text("intro", DEFAULT_STAY_RULES.intro);

  // An explicit array wins, even when empty — the owner may have deleted everything.
  if (Array.isArray(data.sections)) {
    return {
      eyebrow,
      title,
      intro,
      sections: normalizeSections(data.sections, preserveDrafts),
    };
  }

  // Legacy shape: single prohibitions list without sections
  const legacyItems = normalizeItems(data.prohibitions || data.items, false);
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
          icon: "cross",
          items: legacyItems,
        },
      ],
    };
  }

  return { eyebrow, title, intro, sections: cloneDefaultSections() };
}

/** Resolve public stay-rules from branding, falling back to defaults. */
export function resolveStayRules(
  branding?: StayRulesBrandingInput | null
): StayRulesContent {
  return resolveInternal(branding, false);
}

/** Same data, but blank drafts are kept so the admin editor stays editable. */
export function resolveStayRulesForEditing(
  branding?: StayRulesBrandingInput | null
): StayRulesContent {
  return resolveInternal(branding, true);
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
        icon: normalizeStayRuleMark(section.icon),
        items: section.items.map((item) => item.trim()).filter(Boolean),
      }))
      .filter((section) => section.title || section.items.length > 0)
      .map((section) => ({
        ...section,
        title: section.title || "Правила",
      })),
  };
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function stayRulesSummaryLabel(content: StayRulesContent): string {
  const sections = content.sections.length;
  if (!sections) return "Немає розділів";
  const items = content.sections.reduce(
    (n, s) => n + s.items.filter((item) => item.trim()).length,
    0
  );
  return `${sections} ${plural(sections, "розділ", "розділи", "розділів")} · ${items} ${plural(items, "пункт", "пункти", "пунктів")}`;
}
