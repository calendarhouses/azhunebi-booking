const MAPS_HOST_RE =
  /^(?:[a-z0-9-]+\.)*(?:google\.(?:com|[a-z]{2,3})|goo\.gl|maps\.app\.goo\.gl)$/i;

export function isGoogleMapsUrl(raw: string): boolean {
  try {
    const host = new URL(raw.trim()).hostname.toLowerCase();
    return MAPS_HOST_RE.test(host);
  } catch {
    return false;
  }
}

/** Перетворює розгорнуте посилання Google Maps на iframe embed (без API key). */
export function googleMapsUrlToEmbed(resolvedUrl: string): string | null {
  const url = resolvedUrl.trim();
  if (!url) return null;
  if (url.includes("/maps/embed")) return url;

  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) {
    return embedFromQuery(`${at[1]},${at[2]}`);
  }

  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get("q");
    if (q) return embedFromQuery(q);

    const ll = parsed.searchParams.get("ll");
    if (ll) return embedFromQuery(ll);
  } catch {
    /* ignore */
  }

  const place = url.match(/\/maps\/place\/([^/?#]+)/);
  if (place) {
    const name = decodeURIComponent(place[1].replace(/\+/g, " "));
    return embedFromQuery(name);
  }

  return null;
}

function embedFromQuery(q: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&hl=uk&z=15&output=embed`;
}

export async function resolveGoogleMapsEmbedUrl(
  externalUrl: string
): Promise<{ embedUrl: string | null; externalUrl: string }> {
  const trimmed = externalUrl.trim();
  if (!trimmed || !isGoogleMapsUrl(trimmed)) {
    return { embedUrl: null, externalUrl: trimmed };
  }

  if (trimmed.includes("/maps/embed")) {
    return { embedUrl: trimmed, externalUrl: trimmed };
  }

  const direct = googleMapsUrlToEmbed(trimmed);
  if (direct) {
    return { embedUrl: direct, externalUrl: trimmed };
  }

  const res = await fetch(`/api/maps/resolve?url=${encodeURIComponent(trimmed)}`);
  if (!res.ok) {
    return { embedUrl: null, externalUrl: trimmed };
  }

  const data = (await res.json()) as { embedUrl?: string | null; externalUrl?: string };
  return {
    embedUrl: data.embedUrl || null,
    externalUrl: data.externalUrl || trimmed,
  };
}
