/** EasyPay catalog page for TurboSMS balance top-up (no login to turbosms.ua required). */
export const EASYPAY_TURBOSMS_URL =
  "https://easypay.ua/ua/catalog/online-services/sms/turbosms";

/** Fixed TurboSMS client ID for EasyPay top-up. */
export const TURBOSMS_CLIENT_ID = "8897694";

export async function copyTurboSmsClientId(clientId: string = TURBOSMS_CLIENT_ID): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(clientId);
    return true;
  } catch {
    return false;
  }
}

export function openEasyPayTurboSmsTopUp(): void {
  window.open(EASYPAY_TURBOSMS_URL, "_blank", "noopener,noreferrer");
}
