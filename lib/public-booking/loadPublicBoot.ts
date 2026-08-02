import "server-only";

import { fetchInitData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";
import type { PublicTenantPayload } from "@/lib/public-booking/types";
import {
  coalesceKey,
  OCCUPANCY_CACHE_TTL_MS,
  readGasShortCache,
  withGasInflightCoalesce,
  writeGasShortCache,
} from "@/lib/gas/inflightCoalesce";
import {
  readSharedGasCache,
  syncSharedCacheGeneration,
  writeSharedGasCache,
} from "@/lib/gas/sharedReadCache";

const PUBLIC_INIT_TTL_MS = OCCUPANCY_CACHE_TTL_MS;

function tenantFromInit(tenantId: string, init: AdminInitResponse): PublicTenantPayload {
  const settings = init.settings || {};
  const rooms = Array.isArray(settings.roomsList) ? settings.roomsList : [];
  const branding =
    settings.branding && typeof settings.branding === "object"
      ? (settings.branding as PublicTenantPayload["branding"])
      : {};
  return {
    tenantId,
    tenantName: String(
      (branding as { site_title?: string }).site_title || tenantId || "Ажунебі"
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
}

/**
 * Single GAS round-trip for public boot, coalesced + short-TTL cached
 * (in-process + shared Redis) so N tabs/devices don't each hit Apps Script.
 */
export async function loadPublicBoot(tenantId: string): Promise<{
  tenant: PublicTenantPayload;
  init: AdminInitResponse;
  cache: "HIT" | "REDIS_HIT" | "MISS" | "COALESCE";
} | null> {
  const key = coalesceKey({
    method: "GET",
    action: "initData",
    tenant: tenantId,
  });

  try {
    await syncSharedCacheGeneration();
    const cached = readGasShortCache(key);
    if (cached?.body) {
      const init = JSON.parse(cached.body) as AdminInitResponse;
      return { tenant: tenantFromInit(tenantId, init), init, cache: "HIT" };
    }

    const shared = await readSharedGasCache(key);
    if (shared?.body) {
      writeGasShortCache(key, shared.body, shared.status, PUBLIC_INIT_TTL_MS);
      const init = JSON.parse(shared.body) as AdminInitResponse;
      return {
        tenant: tenantFromInit(tenantId, init),
        init,
        cache: "REDIS_HIT",
      };
    }

    const { text, shared: coalesced } = await withGasInflightCoalesce(key, async () => {
      const init = await fetchInitData(tenantId);
      const body = JSON.stringify(init);
      writeGasShortCache(key, body, 200, PUBLIC_INIT_TTL_MS);
      await writeSharedGasCache(key, body, 200, PUBLIC_INIT_TTL_MS);
      return body;
    });

    const init = JSON.parse(text) as AdminInitResponse;
    return {
      tenant: tenantFromInit(tenantId, init),
      init,
      cache: coalesced ? "COALESCE" : "MISS",
    };
  } catch (err) {
    console.error("loadPublicBoot:", err);
    return null;
  }
}
