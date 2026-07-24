"use client";

import {
  STAY_RULES_EYEBROW,
  STAY_RULES_INTRO,
  STAY_RULES_PROHIBITIONS,
  STAY_RULES_PROHIBITIONS_LABEL,
  STAY_RULES_TITLE,
} from "@/lib/public-booking/stayRules";

export function BookingStayRules() {
  return (
    <section className="stay-rules" aria-labelledby="stay-rules-title">
      <div className="stay-rules__glow" aria-hidden />
      <div className="stay-rules__inner">
        <p className="stay-rules__eyebrow">{STAY_RULES_EYEBROW}</p>
        <h2 id="stay-rules-title" className="stay-rules__title">
          {STAY_RULES_TITLE}
        </h2>
        <p className="stay-rules__intro">{STAY_RULES_INTRO}</p>

        <div className="stay-rules__divider" aria-hidden>
          <span />
        </div>

        <p className="stay-rules__forbid-label">{STAY_RULES_PROHIBITIONS_LABEL}</p>
        <ul className="stay-rules__list">
          {STAY_RULES_PROHIBITIONS.map((item) => (
            <li key={item} className="stay-rules__item">
              <span className="stay-rules__mark" aria-hidden>
                ×
              </span>
              <span className="stay-rules__text">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
