import { getHighlightIconOptionById } from "@/lib/admin/roomSiteHighlights";

const ICON_SIZE = 20;
const ICON_STROKE = 1.5;

export function PublicHighlightIcon({ iconId }: { iconId: string }) {
  const { Icon } = getHighlightIconOptionById(iconId);
  return (
    <Icon
      className="public-amenity-icon"
      size={ICON_SIZE}
      strokeWidth={ICON_STROKE}
      aria-hidden
    />
  );
}
