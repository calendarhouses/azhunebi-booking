"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicBranding } from "@/lib/public-booking/types";
import { googleMapsUrlToEmbed, resolveGoogleMapsEmbedUrl } from "@/lib/googleMapsUrl";

type Props = {
  branding: PublicBranding;
  /** Defer iframe until section is near viewport (safer on mobile Safari). */
  lazyMount?: boolean;
};

export function BrandingMapSection({ branding, lazyMount = false }: Props) {
  const storedEmbed = String(branding.maps_embed_url || "").trim();
  const storedExternal = String(branding.maps_external_url || "").trim();

  const [embedUrl, setEmbedUrl] = useState(storedEmbed);
  const [externalUrl, setExternalUrl] = useState(storedExternal);
  const [shouldMountMap, setShouldMountMap] = useState(!lazyMount);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (storedEmbed) {
        setEmbedUrl(storedEmbed);
        setExternalUrl(storedExternal || storedEmbed);
        return;
      }

      if (!storedExternal) {
        setEmbedUrl("");
        setExternalUrl("");
        return;
      }

      const direct = googleMapsUrlToEmbed(storedExternal);
      if (direct) {
        setEmbedUrl(direct);
        setExternalUrl(storedExternal);
        return;
      }

      const resolved = await resolveGoogleMapsEmbedUrl(storedExternal);
      if (cancelled) return;
      setEmbedUrl(resolved.embedUrl || "");
      setExternalUrl(resolved.externalUrl || storedExternal);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [storedEmbed, storedExternal]);

  useEffect(() => {
    if (!lazyMount || shouldMountMap) return;
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShouldMountMap(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldMountMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [lazyMount, shouldMountMap]);

  if (!embedUrl && !externalUrl) return null;

  return (
    <div ref={sectionRef}>
      <div className="divider" />
      <h3 className="section-title">Ви відпочиватимете тут</h3>
      {shouldMountMap && embedUrl ? (
        <div className="map-wrapper">
          <iframe
            src={embedUrl}
            width="600"
            height="450"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Карта"
          />
        </div>
      ) : null}
      {externalUrl ? (
        <a href={externalUrl} target="_blank" rel="noreferrer" className="map-external-link">
          ПРОКЛАСТИ МАРШРУТ
        </a>
      ) : null}
    </div>
  );
}
