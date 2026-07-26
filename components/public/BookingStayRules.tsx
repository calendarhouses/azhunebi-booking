"use client";

import { resolveStayRules, type StayRulesContent } from "@/lib/public-booking/stayRules";
import { StayRuleMarkIcon } from "@/components/ui/StayRuleMarkIcon";
import type { PublicBranding } from "@/lib/public-booking/types";

type Props = {
  branding?: PublicBranding | null;
  content?: StayRulesContent | null;
};

export function BookingStayRules({ branding, content }: Props) {
  const rules = content || resolveStayRules(branding);

  return (
    <section className="stay-rules" aria-labelledby="stay-rules-title">
      <div className="stay-rules__glow" aria-hidden />
      <div className="stay-rules__inner">
        <p className="stay-rules__eyebrow">{rules.eyebrow}</p>
        <h2 id="stay-rules-title" className="stay-rules__title">
          {rules.title}
        </h2>
        <p className="stay-rules__intro">{rules.intro}</p>

        <div className="stay-rules__divider" aria-hidden>
          <span />
        </div>

        <div className="stay-rules__sections">
          {rules.sections.map((section) => (
            <div key={section.id} className="stay-rules__section">
              <p className="stay-rules__forbid-label">{section.title}</p>
              <ul className="stay-rules__list">
                {section.items.map((item, itemIndex) => (
                  <li key={`${section.id}-${itemIndex}`} className="stay-rules__item">
                    <span
                      className={`stay-rules__mark stay-rules__mark--${section.icon}`}
                      aria-hidden
                    >
                      <StayRuleMarkIcon mark={section.icon} size={15} />
                    </span>
                    <span className="stay-rules__text">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
