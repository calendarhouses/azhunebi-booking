export function getWayForPaySecretKey(): string | null {
  const key = process.env.WAYFORPAY_SECRET_KEY?.trim();
  return key || null;
}

export function getWayForPayMerchantAccount(): string {
  return (
    process.env.WAYFORPAY_MERCHANT_ACCOUNT?.trim() || "www_instagram_com_15241"
  );
}

export function getWayForPayMerchantDomain(): string {
  return (
    process.env.WAYFORPAY_MERCHANT_DOMAIN?.trim() ||
    "calendarhouses.github.io/booking/"
  );
}
