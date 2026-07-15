const FAKE = "FAKE_TEST_KEY_DO_NOT_TOUCH";

export type TurboSmsConfig = {
  token: string;
  sender: string;
  enabled: boolean;
};

export function getTurboSmsConfig(): TurboSmsConfig {
  const token = process.env.TURBOSMS_TOKEN?.trim() || FAKE;
  return {
    token,
    sender: process.env.TURBOSMS_SENDER?.trim() || "Zamovlenya",
    enabled: process.env.TURBOSMS_ENABLED !== "false",
  };
}

export function isTurboSmsConfigured(): boolean {
  const cfg = getTurboSmsConfig();
  return cfg.enabled && cfg.token !== FAKE && !cfg.token.includes("FAKE");
}
