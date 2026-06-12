"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import "@/components/admin/rooms/settings-rooms-accordion.css";

export const SETTINGS_ROOM_ACCORDION_ANIMATION_MS = 380;
export const SETTINGS_DISCOUNT_ACCORDION_ANIMATION_MS = 560;

/** @deprecated Use SETTINGS_ROOM_ACCORDION_ANIMATION_MS or SETTINGS_DISCOUNT_ACCORDION_ANIMATION_MS */
export const SETTINGS_ACCORDION_ANIMATION_MS = SETTINGS_ROOM_ACCORDION_ANIMATION_MS;

type SettingsRoomExpandRowProps = {
  open: boolean;
  colSpan: number;
  className?: string;
  animationMs?: number;
  children: ReactNode;
};

export function SettingsRoomExpandRow({
  open,
  colSpan,
  className = "",
  animationMs = SETTINGS_ROOM_ACCORDION_ANIMATION_MS,
  children,
}: SettingsRoomExpandRowProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setVisible(false);
      let innerRaf = 0;
      const outerRaf = requestAnimationFrame(() => {
        innerRaf = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outerRaf);
        cancelAnimationFrame(innerRaf);
      };
    }

    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), animationMs);
    return () => window.clearTimeout(timer);
  }, [open, animationMs]);

  if (!mounted) return null;

  const style = {
    "--khata-accordion-duration": `${animationMs}ms`,
  } as CSSProperties;

  return (
    <tr
      className={`settings-rooms-expand${visible ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      style={style}
    >
      <td colSpan={colSpan}>
        <div className="settings-rooms-expand__wrap">
          <div className="settings-rooms-expand__inner">{children}</div>
        </div>
      </td>
    </tr>
  );
}
