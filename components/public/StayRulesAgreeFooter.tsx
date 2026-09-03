"use client";

type Props = {
  unlocked: boolean;
  submitting?: boolean;
  blocked?: boolean;
  onAgree: () => void;
  onBack?: () => void;
  agreeLabel?: string;
  hint?: string;
};

export function StayRulesAgreeFooter({
  unlocked,
  submitting = false,
  blocked = false,
  onAgree,
  onBack,
  agreeLabel = "Погоджуюсь",
  hint = "Прогорніть правила до кінця",
}: Props) {
  const agreeDisabled = submitting || blocked || !unlocked;

  return (
    <div className="sticky-cta sticky-cta--rules">
      {!unlocked ? (
        <p className="rules-scroll-hint" id="rules-scroll-hint">
          {hint}
        </p>
      ) : null}
      <button
        type="button"
        className="btn-proceed"
        id="agreeRulesBtn"
        disabled={agreeDisabled}
        aria-describedby={!unlocked ? "rules-scroll-hint" : undefined}
        onClick={onAgree}
      >
        {submitting ? "Відправляємо..." : agreeLabel}
      </button>
      {onBack ? (
        <button
          type="button"
          className="btn-rules-back"
          disabled={submitting}
          onClick={onBack}
        >
          Повернутися
        </button>
      ) : null}
    </div>
  );
}
