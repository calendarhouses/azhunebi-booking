import "server-only";

import { fetchInitData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";
import type { PublicTenantPayload } from "@/lib/public-booking/types";

/**
 * Single GAS round-trip for public boot (replaces fetchPublicTenant + client initData).
 */
export async function loadPublicBoot(tenantId: string): Promise<{
  tenant: PublicTenantPayload;
  init: AdminInitResponse;
} | null> {
  try {
    const init = await fetchInitData(tenantId);
    const settings = init.settings || {};
    const rooms = Array.isArray(settings.roomsList) ? settings.roomsList : [];
    const branding =
      settings.branding && typeof settings.branding === "object"
        ? (settings.branding as PublicTenantPayload["branding"])
        : {};
    const tenant: PublicTenantPayload = {
      tenantId,
      tenantName: String(
        (branding as { site_title?: string }).site_title ||
          tenantId ||
          "Ажунебі"
      ),
      subdomain: tenantId,
      branding,
      rooms: rooms as PublicTenantPayload["rooms"],
      discounts: (Array.isArray(settings.discountsList)
        ? settings.discountsList
        : []) as PublicTenantPayload["discounts"],
      customPrices:
        settings.customPrices && typeof settings.customPrices === "object"
          ? (settings.customPrices as PublicTenantPayload["customPrices"])
          : {},
    };
    return { tenant, init };
  } catch (err) {
    console.error("loadPublicBoot:", err);
    return null;
  }
}
