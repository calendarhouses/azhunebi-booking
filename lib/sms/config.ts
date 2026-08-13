const FAKE = "FAKE_TEST_KEY_DO_NOT_TOUCH";

/** Approved TurboSMS alphanumeric sender. */
export const TURBOSMS_DEFAULT_SENDER = "AZH U NEBI";

export type TurboSmsConfig = {
  token: string;
  sender: string;
  enabled: boolean;
};

function resolveSender(): string {
  const fromEnv = process.env.TURBOSMS_SENDER?.trim() || "";
  // Legacy shared sender — always prefer the approved brand name.
  if (!fromEnv || /^zamovlenya$/i.test(fromEnv) || /^zamavlenya$/i.test(fromEnv)) {
    return TURBOSMS_DEFAULT_SENDER;
  }
  return fromEnv;
}

export function getTurboSmsConfig(): TurboSmsConfig {
  const token = process.env.TURBOSMS_TOKEN?.trim() || FAKE;
  return {
    token,
    sender: resolveSender(),
    enabled: process.env.TURBOSMS_ENABLED !== "false",
  };
}

export function isTurboSmsConfigured(): boolean {
  const cfg = getTurboSmsConfig();
  return cfg.enabled && cfg.token !== FAKE && !cfg.token.includes("FAKE");
}
