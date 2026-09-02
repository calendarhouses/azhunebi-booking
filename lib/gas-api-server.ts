import "server-only";

import { handleBackendRequest } from "@/lib/backend/handleBackendRequest";

const GAS_FETCH_TIMEOUT_MS = 45_000;

function gasFetchSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(GAS_FETCH_TIMEOUT_MS);
  }
  return undefined;
}

function assertGasUrl(): string {
  const url = process.env.NEXT_PUBLIC_GAS_URL?.trim() || "";
  if (!url) {
    throw new Error("NEXT_PUBLIC_GAS_URL is not configured");
  }
  return url;
}

function throwBackendError(status: number, body: Record<string, unknown>): void {
  const errCode = String(body.error || "");
  if (status === 401 || errCode === "UNAUTHORIZED") {
    throw new Error("UNAUTHORIZED");
  }
  throw new Error(String(body.message || body.error || `HTTP ${status}`));
}

/** Server-only: route through DATA_SOURCE dispatcher (Supabase or GAS), no HTTP loopback. */
export async function serverGasFetch<T>(
  params: Record<string, string | number | undefined>,
  authToken?: string | null
): Promise<T> {
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") query[k] = String(v);
  }
  const result = await handleBackendRequest(
    { method: "GET", token: authToken || null, query, body: null },
    async (req) => {
      const url = assertGasUrl();
      const target = new URL(url);
      for (const [k, v] of Object.entries(req.query)) target.searchParams.set(k, v);
      if (req.token) target.searchParams.set("token", req.token);
      const res = await fetch(target.toString(), {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: gasFetchSignal(),
      });
      const data = (await res.json()) as Record<string, unknown>;
      return { status: res.status, body: data };
    }
  );
  if (result.status >= 400) {
    throwBackendError(result.status, result.body);
  }
  return result.body as T;
}

export async function serverGasPost<T>(
  body: Record<string, unknown>,
  authToken?: string | null
): Promise<T> {
  const payload = { ...body };
  if (authToken && payload.accessToken === undefined) payload.accessToken = authToken;
  const result = await handleBackendRequest(
    { method: "POST", token: authToken || null, query: {}, body: payload },
    async (req) => {
      const url = assertGasUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(req.body || {}),
        cache: "no-store",
        redirect: "follow",
        signal: gasFetchSignal(),
      });
      const data = (await res.json()) as Record<string, unknown>;
      return { status: res.status, body: data };
    }
  );
  if (result.status >= 400) {
    throwBackendError(result.status, result.body);
  }
  return result.body as T;
}
