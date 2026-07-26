"use client";

import { useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react";
import type { StayRulesContent, StayRulesSection } from "@/lib/public-booking/stayRules";
import {
  createEmptyStayRulesSection,
  stayRulesSummaryLabel,
} from "@/lib/public-booking/stayRules";

type Props = {
  open: boolean;
  onToggle: () => void;
  value: StayRulesContent;
  onChange: (next: StayRulesContent) => void;
};

export function StayRulesSettingsAccordion({
  open,
  onToggle,
  value,
  onChange,
}: Props) {
  const patchRoot = useCallback(
    (key: keyof Pick<StayRulesContent, "eyebrow" | "title" | "intro">, text: string) => {
      onChange({ ...value, [key]: text });
    },
    [onChange, value]
  );

  const updateSection = useCallback(
    (sectionId: string, patch: Partial<StayRulesSection>) => {
      onChange({
        ...value,
        sections: value.sections.map((s) =>
          s.id === sectionId ? { ...s, ...patch } : s
        ),
      });
    },
    [onChange, value]
  );

  const moveSection = useCallback(
    (index: number, dir: -1 | 1) => {
      const next = index + dir;
      if (next < 0 || next >= value.sections.length) return;
      const sections = [...value.sections];
      const [row] = sections.splice(index, 1);
      sections.splice(next, 0, row);
      onChange({ ...value, sections });
    },
    [onChange, value]
  );

  const removeSection = useCallback(
    (sectionId: string) => {
      onChange({
        ...value,
        sections: value.sections.filter((s) => s.id !== sectionId),
      });
    },
    [onChange, value]
  );

  const addSection = useCallback(() => {
    onChange({
      ...value,
      sections: [...value.sections, createEmptyStayRulesSection("Новий розділ")],
    });
  }, [onChange, value]);

  const updateItem = useCallback(
    (sectionId: string, itemIndex: number, text: string) => {
      onChange({
        ...value,
        sections: value.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const items = [...s.items];
          items[itemIndex] = text;
          return { ...s, items };
        }),
      });
    },
    [onChange, value]
  );

  const addItem = useCallback(
    (sectionId: string) => {
      onChange({
        ...value,
        sections: value.sections.map((s) =>
          s.id === sectionId ? { ...s, items: [...s.items, ""] } : s
        ),
      });
    },
    [onChange, value]
  );

  const removeItem = useCallback(
    (sectionId: string, itemIndex: number) => {
      onChange({
        ...value,
        sections: value.sections.map((s) => {
          if (s.id !== sectionId) return s;
          const items = s.items.filter((_, i) => i !== itemIndex);
          return { ...s, items: items.length ? items : [""] };
        }),
      });
    },
    [onChange, value]
  );

  return (
    <section
      className={`svc-accordion branding-svc-accordion branding-rules-accordion branding-field--full${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="svc-accordion__trigger"
        aria-expanded={open}
        aria-controls="branding-rules-panel"
        onClick={onToggle}
      >
        <div className="svc-accordion__trigger-main">
          <span className="svc-accordion__icon" aria-hidden>
            <ScrollText size={18} />
          </span>
          <div className="svc-accordion__trigger-text">
            <span className="svc-accordion__label">Правила проживання</span>
            <span className="svc-accordion__hint">{stayRulesSummaryLabel(value)}</span>
          </div>
        </div>
        <ChevronDown size={18} className="svc-accordion__chevron" aria-hidden />
      </button>

      <div
        id="branding-rules-panel"
        className="branding-svc-collapse svc-accordion__collapse"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="branding-svc-collapse__panel">
          <div className="branding-svc-collapse__content svc-accordion__panel">
            <p className="svc-accordion__intro">
              Сторінка, яку гість бачить перед підтвердженням броні. Можна додати
              окремі розділи — наприклад виселення чи повернення коштів — кожен
              пункт покажеться карткою на сайті.
            </p>

            <div className="svc-accordion__section stay-rules-editor__hero">
              <label className="svc-field">
                <span className="svc-field__label">Надзаголовок</span>
                <input
                  className="svc-field__input"
                  type="text"
                  value={value.eyebrow}
                  placeholder="Внутрішні правила"
                  onChange={(e) => patchRoot("eyebrow", e.target.value)}
                />
              </label>
              <label className="svc-field">
                <span className="svc-field__label">Заголовок</span>
                <input
                  className="svc-field__input"
                  type="text"
                  value={value.title}
                  placeholder="Спокійний відпочинок"
                  onChange={(e) => patchRoot("title", e.target.value)}
                />
              </label>
              <label className="svc-field">
                <span className="svc-field__label">Підзаголовок</span>
                <textarea
                  className="svc-field__input stay-rules-editor__intro"
                  rows={3}
                  value={value.intro}
                  placeholder="Короткий вступ для гостя…"
                  onChange={(e) => patchRoot("intro", e.target.value)}
                />
              </label>
            </div>

            <div className="svc-accordion__section">
              <div className="stay-rules-editor__sections-head">
                <span className="svc-field__label">Розділи правил</span>
                <button
                  type="button"
                  className="stay-rules-editor__add-section"
                  onClick={addSection}
                >
                  <Plus size={15} strokeWidth={2.4} />
                  Додати розділ
                </button>
              </div>

              <div className="stay-rules-editor__sections">
                {value.sections.length === 0 ? (
                  <div className="stay-rules-editor__empty">
                    Ще немає розділів. Додайте, наприклад, «У нас не можна» або
                    «Правила виселення».
                  </div>
                ) : (
                  value.sections.map((section, index) => (
                    <article key={section.id} className="stay-rules-editor__card">
                      <header className="stay-rules-editor__card-head">
                        <input
                          className="stay-rules-editor__section-title"
                          type="text"
                          value={section.title}
                          placeholder="Назва розділу"
                          onChange={(e) =>
                            updateSection(section.id, { title: e.target.value })
                          }
                        />
                        <div className="stay-rules-editor__card-actions">
                          <button
                            type="button"
                            className="stay-rules-editor__icon-btn"
                            title="Вище"
                            disabled={index === 0}
                            onClick={() => moveSection(index, -1)}
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            className="stay-rules-editor__icon-btn"
                            title="Нижче"
                            disabled={index === value.sections.length - 1}
                            onClick={() => moveSection(index, 1)}
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            type="button"
                            className="stay-rules-editor__icon-btn is-danger"
                            title="Видалити розділ"
                            onClick={() => removeSection(section.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </header>

                      <ul className="stay-rules-editor__items">
                        {section.items.map((item, itemIndex) => (
                          <li key={`${section.id}-${itemIndex}`}>
                            <span className="stay-rules-editor__bullet" aria-hidden>
                              ×
                            </span>
                            <input
                              type="text"
                              value={item}
                              placeholder="Текст правила…"
                              onChange={(e) =>
                                updateItem(section.id, itemIndex, e.target.value)
                              }
                            />
                            <button
                              type="button"
                              className="stay-rules-editor__icon-btn is-danger"
                              title="Видалити пункт"
                              onClick={() => removeItem(section.id, itemIndex)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>

                      <button
                        type="button"
                        className="stay-rules-editor__add-item"
                        onClick={() => addItem(section.id)}
                      >
                        <Plus size={14} strokeWidth={2.4} />
                        Додати пункт
                      </button>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
