import type { PublicRoom } from "./types";

export function formatRoomDisplayName(room: Pick<PublicRoom, "name">): string {
  return (room.name || "").trim();
}

export function getRoomBadgeLabel(room: Pick<PublicRoom, "name" | "desc">): string {
  const desc = (room.desc || "").trim();
  if (!desc || desc === "()" || desc === room.name) return "";
  return desc;
}

function firstSentence(text: string): string {
  const first = text.split(/[.!?]/)[0]?.trim();
  if (!first) return text;
  return first.endsWith(".") ? first : `${first}.`;
}

export function getRoomSubtitle(room: PublicRoom): string {
  const name = (room.name || "").trim();

  const detailed = (room.detailedDescription || "").trim();
  if (detailed && detailed !== name) {
    const snippet = firstSentence(detailed);
    if (snippet !== name && snippet !== `${name}.`) return snippet;
    return detailed;
  }

  // room.short — назва в шахматці, не для сайту
  const desc = (room.desc || "").trim();
  if (!desc || desc === name) return "";

  const subtitle = firstSentence(desc);
  if (subtitle === name || subtitle === `${name}.`) return "";
  return subtitle;
}
