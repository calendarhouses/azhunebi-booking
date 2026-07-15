import { NextResponse } from "next/server";
import { googleMapsUrlToEmbed, isGoogleMapsUrl } from "@/lib/googleMapsUrl";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")?.trim();
  if (!raw || !isGoogleMapsUrl(raw)) {
    return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
  }

  if (raw.includes("/maps/embed")) {
    return NextResponse.json({ externalUrl: raw, embedUrl: raw });
  }

  const direct = googleMapsUrlToEmbed(raw);
  if (direct) {
    return NextResponse.json({ externalUrl: raw, embedUrl: direct });
  }

  try {
    const upstream = await fetch(raw, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; KhataBooking/1.0; +https://hata.ua)",
      },
    });

    const finalUrl = upstream.url || raw;
    const embedUrl = googleMapsUrlToEmbed(finalUrl);

    return NextResponse.json({
      externalUrl: finalUrl,
      embedUrl,
    });
  } catch {
    return NextResponse.json({ externalUrl: raw, embedUrl: null }, { status: 502 });
  }
}
