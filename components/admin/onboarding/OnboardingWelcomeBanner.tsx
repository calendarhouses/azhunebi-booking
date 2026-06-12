"use client";

import { KhataBrandIcon } from "@/components/ui/icons/KhataBrandIcon";

type OnboardingWelcomeBannerProps = {
  tenantName?: string | null;
  roomsCount: number;
  bookingsCount: number;
  publicBookUrl?: string;
  onDismiss: () => void;
};

export function OnboardingWelcomeBanner({
  tenantName,
  roomsCount: _roomsCount,
  bookingsCount: _bookingsCount,
  publicBookUrl,
  onDismiss,
}: OnboardingWelcomeBannerProps) {
  void tenantName;

  return (
    <section className="khata-onboarding-welcome" aria-label="Вітання">
      <button
        type="button"
        className="khata-onboarding-welcome__dismiss"
        onClick={onDismiss}
        aria-label="Закрити"
        title="Закрити"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="flex flex-row items-center justify-between p-5">
        <div className="flex items-center gap-5">
          <KhataBrandIcon className="w-20 h-20 shrink-0 text-[#7a9248]" />
          <div className="flex flex-col">
            <h3 className="text-2xl font-bold text-slate-900 leading-tight">Твоя ХАТА готова!</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">
              Ось твій сайт бронювання — іди подивись, як він виглядає, і поділись ним із першими
              гостями.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {publicBookUrl ? (
            <a
              href={publicBookUrl}
              target="_blank"
              rel="noreferrer"
              className="khata-onboarding-welcome__cta"
            >
              Відкрити сайт
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 4h5v5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m10 14 10-10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
