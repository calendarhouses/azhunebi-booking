"use client";

import { useEffect, useState } from "react";
import type { PublicBranding } from "@/lib/public-booking/types";
import { googleMapsUrlToEmbed, resolveGoogleMapsEmbedUrl } from "@/lib/googleMapsUrl";

type Props = {
  branding: PublicBranding;
};

export function BrandingMapSection({ branding }: Props) {
  const storedEmbed = String(branding.maps_embed_url || "").trim();
  const storedExternal = String(branding.maps_external_url || "").trim();

  const [embedUrl, setEmbedUrl] = useState(storedEmbed);
  const [externalUrl, setExternalUrl] = useState(storedExternal);

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

  if (!embedUrl && !externalUrl) return null;

  return (
    <>
      <div className="divider" />
      <h3 className="section-title">Ви відпочиватимете тут</h3>
      {embedUrl ? (
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
    </>
  );
}
