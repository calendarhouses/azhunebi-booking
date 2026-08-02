import "server-only";

import { fetchInitData } from "@/lib/gas-api";
import type { AdminInitResponse } from "@/components/admin/desktop/types";
import type { PublicTenantPayload } from "@/lib/public-booking/types";
import {
  coalesceKey,
  isSuccessfulGasReadBody,
  OCCUPANCY_CACHE_TTL_MS,
  readGasShortCache,
  withGasInflightCoalesce,
  writeGasShortCache,
} from "@/lib/gas/inflightCoalesce";
import {
  isCacheableGasReadBody,
  readLastGoodGasCache,
  readSharedGasCache,
  syncSharedCacheGeneration,
  withSharedSingleflight,
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

function parseInit(body: string): AdminInitResponse {
  return JSON.parse(body) as AdminInitResponse;
}

/**
 * Single GAS round-trip for public boot, coalesced + short-TTL cached
 * (in-process + shared Redis) so N tabs/devices don't each hit Apps Script.
 */
export async function loadPublicBoot(tenantId: string): Promise<{
  tenant: PublicTenantPayload;
  init: AdminInitResponse;
  cache: "HIT" | "REDIS_HIT" | "MISS" | "COALESCE" | "STALE";
} | null> {
  const key = coalesceKey({
    method: "GET",
    action: "initData",
    tenant: tenantId,
  });

  try {
    await syncSharedCacheGeneration();
    const cached = readGasShortCache(key);
    if (cached?.body && isCacheableGasReadBody("initData", cached.body)) {
      const init = parseInit(cached.body);
      return { tenant: tenantFromInit(tenantId, init), init, cache: "HIT" };
    }

    const shared = await readSharedGasCache(key);
    if (shared?.body && isCacheableGasReadBody("initData", shared.body)) {
      writeGasShortCache(key, shared.body, shared.status, PUBLIC_INIT_TTL_MS);
      const init = parseInit(shared.body);
      return {
        tenant: tenantFromInit(tenantId, init),
        init,
        cache: "REDIS_HIT",
      };
    }

    const { text, shared: coalesced } = await withGasInflightCoalesce(key, async () => {
      const { text: body } = await withSharedSingleflight(key, async () => {
        const init = await fetchInitData(tenantId);
        return JSON.stringify(init);
      });
      if (!isSuccessfulGasReadBody(body)) {
        throw new Error("GAS_ERROR_BODY");
      }
      if (isCacheableGasReadBody("initData", body)) {
        writeGasShortCache(key, body, 200, PUBLIC_INIT_TTL_MS);
        await writeSharedGasCache(key, body, 200, PUBLIC_INIT_TTL_MS, "initData");
      }
      return body;
    });

    const init = parseInit(text);
    return {
      tenant: tenantFromInit(tenantId, init),
      init,
      cache: coalesced ? "COALESCE" : "MISS",
    };
  } catch (err) {
    console.error("loadPublicBoot:", err);
    const stale = await readLastGoodGasCache(key);
    if (stale?.body && isCacheableGasReadBody("initData", stale.body)) {
      writeGasShortCache(key, stale.body, stale.status, PUBLIC_INIT_TTL_MS);
      const init = parseInit(stale.body);
      return {
        tenant: tenantFromInit(tenantId, init),
        init,
        cache: "STALE",
      };
    }
    return null;
  }
}
