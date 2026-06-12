"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { RoomSiteHighlight } from "@/components/admin/desktop/types";
import {
  getHighlightIconOption,
  getSlotHighlightOptions,
  shouldAutofillHighlightText,
} from "@/lib/admin/roomSiteHighlights";

type RoomSiteHighlightsEditorProps = {
  value: RoomSiteHighlight[];
  onChange: (next: RoomSiteHighlight[]) => void;
  disabled?: boolean;
};

type PickerAnchor = {
  slotIndex: number;
  el: HTMLButtonElement;
};

type PickerTooltip = {
  text: string;
  top: number;
  left: number;
};

const PICKER_TOOLTIP_DELAY_MS = 420;

function HighlightIconPickerPortal({
  anchor,
  row,
  slotIndex,
  disabled,
  onSelect,
  onClose,
}: {
  anchor: PickerAnchor;
  row: RoomSiteHighlight;
  slotIndex: number;
  disabled: boolean;
  onSelect: (iconId: string) => void;
  onClose: () => void;
}) {
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [tooltip, setTooltip] = useState<PickerTooltip | null>(null);

  const clearTooltipTimer = () => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  };

  const hideTooltip = () => {
    clearTooltipTimer();
    setTooltip(null);
  };

  const showTooltipFor = (el: HTMLElement, text: string) => {
    hideTooltip();
    tooltipTimerRef.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setTooltip({
        text,
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }, PICKER_TOOLTIP_DELAY_MS);
  };

  const updatePosition = useCallback(() => {
    const rect = anchor.el.getBoundingClientRect();
    const pickerWidth = 196;
    const maxLeft = window.innerWidth - pickerWidth - 12;
    setPosition({
      top: rect.bottom + 6,
      left: Math.max(12, Math.min(rect.left, maxLeft)),
    });
  }, [anchor.el]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      hideTooltip();
    };
  }, [updatePosition]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (anchor.el.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [anchor.el, onClose]);

  const slotOptions = getSlotHighlightOptions(slotIndex);

  return createPortal(
    <>
      <div
        ref={pickerRef}
        className="khata-site-highlights__picker khata-site-highlights__picker--portal"
        role="listbox"
        style={{ top: position.top, left: position.left }}
        onMouseLeave={hideTooltip}
      >
        {slotOptions.map((item) => {
          const PickerIcon = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={row.iconId === item.id}
              aria-label={item.template}
              disabled={disabled}
              className={`khata-site-highlights__picker-item${row.iconId === item.id ? " is-active" : ""}`}
              onMouseEnter={(e) => showTooltipFor(e.currentTarget, item.template)}
              onMouseLeave={hideTooltip}
              onFocus={(e) => showTooltipFor(e.currentTarget, item.template)}
              onBlur={hideTooltip}
              onClick={() => onSelect(item.id)}
            >
              <PickerIcon className="h-4 w-4" strokeWidth={1.5} size={16} />
            </button>
          );
        })}
      </div>
      {tooltip ? (
        <div
          className="khata-site-highlights__picker-tooltip"
          role="tooltip"
          style={{ top: tooltip.top, left: tooltip.left }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </>,
    document.body
  );
}

export function RoomSiteHighlightsEditor({
  value,
  onChange,
  disabled = false,
}: RoomSiteHighlightsEditorProps) {
  const [openPicker, setOpenPicker] = useState<PickerAnchor | null>(null);
  const buttonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const updateRow = (index: number, patch: Partial<RoomSiteHighlight>) => {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const selectIcon = (slotIndex: number, iconId: string) => {
    const row = value[slotIndex];
    const option = getHighlightIconOption(iconId, slotIndex);
    const autofill = shouldAutofillHighlightText(row.text, row.iconId, slotIndex);
    updateRow(slotIndex, {
      iconId,
      text: autofill ? option.template : row.text,
    });
    setOpenPicker(null);
  };

  return (
    <div className="khata-site-highlights">
      <div className="khata-site-highlights__heading">
        <p className="khata-site-highlights__title">Головні фішки для сайту</p>
        <p className="khata-site-highlights__desc">
          Три акценти на картці житла. Обери іконку — підставимо текст, який можна змінити.
        </p>
      </div>
      <div className="khata-site-highlights__rows">
        {value.map((row, slotIndex) => {
          const option = getHighlightIconOption(row.iconId, slotIndex);
          const Icon = option.Icon;
          const pickerOpen = openPicker?.slotIndex === slotIndex;

          return (
            <div key={slotIndex} className="khata-site-highlights__row">
              <div className="khata-site-highlights__icon-wrap">
                <button
                  ref={(el) => {
                    buttonRefs.current[slotIndex] = el;
                  }}
                  type="button"
                  className={`khata-site-highlights__icon-btn${pickerOpen ? " is-picker-open" : ""}`}
                  disabled={disabled}
                  aria-label={`Іконка фішки ${slotIndex + 1}`}
                  aria-expanded={pickerOpen}
                  onClick={() => {
                    const el = buttonRefs.current[slotIndex];
                    if (!el) return;
                    setOpenPicker((prev) =>
                      prev?.slotIndex === slotIndex ? null : { slotIndex, el }
                    );
                  }}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} size={18} />
                </button>
              </div>
              <input
                type="text"
                className="khata-site-highlights__input"
                value={row.text}
                disabled={disabled}
                placeholder={option.template}
                onChange={(e) => updateRow(slotIndex, { text: e.target.value })}
              />
            </div>
          );
        })}
      </div>

      {openPicker ? (
        <HighlightIconPickerPortal
          anchor={openPicker}
          row={value[openPicker.slotIndex]}
          slotIndex={openPicker.slotIndex}
          disabled={disabled}
          onSelect={(iconId) => selectIcon(openPicker.slotIndex, iconId)}
          onClose={() => setOpenPicker(null)}
        />
      ) : null}
    </div>
  );
}
