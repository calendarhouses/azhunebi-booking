"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Plus,
  ScrollText,
  Trash2,
} from "lucide-react";
import type {
  StayRulesContent,
  StayRulesSection,
} from "@/lib/public-booking/stayRules";
import {
  createEmptyStayRulesSection,
  STAY_RULE_MARKS,
  stayRulesSummaryLabel,
} from "@/lib/public-booking/stayRules";
import { StayRuleMarkIcon } from "@/components/ui/StayRuleMarkIcon";
import "./settings-stay-rules.css";

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.max(el.scrollHeight, 24)}px`;
}

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

  const rootRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);

  // scrollHeight is 0 while the accordion is collapsed, so re-measure on open too.
  useEffect(() => {
    if (!open) return;
    const nodes = rootRef.current?.querySelectorAll<HTMLTextAreaElement>(
      ".stay-rules-editor__rules textarea"
    );
    nodes?.forEach(autoGrow);
  }, [open, value.sections]);

  // Scroll to and focus a freshly added section once it is in the DOM.
  useEffect(() => {
    if (!focusSectionId) return;
    const el = sectionRefs.current.get(focusSectionId);
    if (!el) return;
    setFocusSectionId(null);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.querySelector<HTMLInputElement>(".stay-rules-editor__section-title")?.focus({
      preventScroll: true,
    });
  }, [focusSectionId, value.sections]);

  const addSection = useCallback(() => {
    const section = createEmptyStayRulesSection("Новий розділ");
    onChange({ ...value, sections: [...value.sections, section] });
    setFocusSectionId(section.id);
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
          <div
            ref={rootRef}
            className="branding-svc-collapse__content svc-accordion__panel stay-rules-editor"
          >
            <div className="stay-rules-editor__meta">
              <label className="stay-rules-editor__field">
                <span>Надзаголовок</span>
                <input
                  type="text"
                  value={value.eyebrow}
                  placeholder="Внутрішні правила"
                  onChange={(e) => patchRoot("eyebrow", e.target.value)}
                />
              </label>
              <label className="stay-rules-editor__field">
                <span>Заголовок</span>
                <input
                  type="text"
                  value={value.title}
                  placeholder="Спокійний відпочинок"
                  onChange={(e) => patchRoot("title", e.target.value)}
                />
              </label>
              <label className="stay-rules-editor__field stay-rules-editor__field--wide">
                <span>Підзаголовок</span>
                <textarea
                  rows={3}
                  value={value.intro}
                  placeholder="Короткий вступ для гостя…"
                  onChange={(e) => patchRoot("intro", e.target.value)}
                />
              </label>
            </div>

            <div className="stay-rules-editor__block">
              <div className="stay-rules-editor__block-head">
                <div>
                  <strong>Розділи</strong>
                  <em>Заголовок розділу + пункти-картки</em>
                </div>
                <button
                  type="button"
                  className="stay-rules-editor__btn-primary"
                  onClick={addSection}
                >
                  <Plus size={16} strokeWidth={2.4} />
                  Додати розділ
                </button>
              </div>

              {value.sections.length === 0 ? (
                <div className="stay-rules-editor__empty">
                  Ще немає розділів. Додайте, наприклад, «У нас не можна» або
                  «Правила виселення».
                </div>
              ) : (
                <div className="stay-rules-editor__list">
                  {value.sections.map((section, index) => (
                    <article
                      key={section.id}
                      className="stay-rules-editor__section"
                      ref={(el) => {
                        if (el) sectionRefs.current.set(section.id, el);
                        else sectionRefs.current.delete(section.id);
                      }}
                    >
                      <div className="stay-rules-editor__section-top">
                        <span className="stay-rules-editor__badge" aria-hidden>
                          {index + 1}
                        </span>
                        <input
                          className="stay-rules-editor__section-title"
                          type="text"
                          value={section.title}
                          placeholder="Назва розділу"
                          onChange={(e) =>
                            updateSection(section.id, { title: e.target.value })
                          }
                        />
                        <div className="stay-rules-editor__toolbar">
                          <button
                            type="button"
                            className="stay-rules-editor__tool"
                            title="Вище"
                            disabled={index === 0}
                            onClick={() => moveSection(index, -1)}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            className="stay-rules-editor__tool"
                            title="Нижче"
                            disabled={index === value.sections.length - 1}
                            onClick={() => moveSection(index, 1)}
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            type="button"
                            className="stay-rules-editor__tool is-danger"
                            title="Видалити розділ"
                            onClick={() => removeSection(section.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="stay-rules-editor__marks">
                        <span className="stay-rules-editor__marks-label">
                          Іконка пунктів
                        </span>
                        <div
                          className="stay-rules-editor__marks-group"
                          role="group"
                          aria-label="Іконка пунктів розділу"
                        >
                          {STAY_RULE_MARKS.map((mark) => (
                            <button
                              key={mark.value}
                              type="button"
                              title={mark.label}
                              aria-pressed={section.icon === mark.value}
                              className={`stay-rules-editor__mark-option is-${mark.value}${
                                section.icon === mark.value ? " is-active" : ""
                              }`}
                              onClick={() =>
                                updateSection(section.id, { icon: mark.value })
                              }
                            >
                              <StayRuleMarkIcon mark={mark.value} size={15} />
                            </button>
                          ))}
                        </div>
                      </div>

                      <ul className="stay-rules-editor__rules">
                        {section.items.map((item, itemIndex) => (
                          <li key={`${section.id}-${itemIndex}`}>
                            <span
                              className={`stay-rules-editor__mark is-${section.icon}`}
                              aria-hidden
                            >
                              <StayRuleMarkIcon mark={section.icon} size={14} />
                            </span>
                            <textarea
                              rows={1}
                              value={item}
                              placeholder="Текст правила…"
                              onChange={(e) => {
                                autoGrow(e.currentTarget);
                                updateItem(section.id, itemIndex, e.target.value);
                              }}
                              onFocus={(e) => autoGrow(e.currentTarget)}
                              ref={autoGrow}
                            />
                            <button
                              type="button"
                              className="stay-rules-editor__tool is-danger"
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
                        className="stay-rules-editor__btn-ghost"
                        onClick={() => addItem(section.id)}
                      >
                        <Plus size={15} strokeWidth={2.4} />
                        Додати пункт
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
