"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CountryCode } from "libphonenumber-js";
import { filterPhoneCountries, getPhoneCountryByIso } from "@/lib/admin/onboarding/phoneCountries";
import type { PhoneCountryOption } from "@/lib/admin/onboarding/phoneCountries";
import {
  composeGuestPhoneDraft,
  formatNationalForDisplay,
  parseNationalInput,
  parseStoredGuestPhone,
} from "@/lib/admin/onboarding/uaPhone";
import "./guest-phone-field.css";

type GuestPhoneFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
};

type PickerPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function clampPickerPosition(prefixRect: DOMRect): PickerPosition {
  const width = Math.min(320, Math.max(prefixRect.width, 260), window.innerWidth - 16);
  let left = prefixRect.left;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

  const top = prefixRect.bottom + 4;
  const maxHeight = Math.min(280, Math.max(160, window.innerHeight - top - 12));

  return { top, left, width, maxHeight };
}

export function GuestPhoneField({ value, onChange, disabled, id }: GuestPhoneFieldProps) {
  const parsed = useMemo(() => parseStoredGuestPhone(value), [value]);
  const [iso, setIso] = useState<CountryCode>(parsed.iso);
  const [dial, setDial] = useState(parsed.dial);
  const [national, setNational] = useState(parsed.national);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pickerPosition, setPickerPosition] = useState<PickerPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const prefixRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIso(parsed.iso);
    setDial(parsed.dial);
    setNational(parsed.national);
  }, [parsed.iso, parsed.dial, parsed.national]);

  const country = useMemo(() => getPhoneCountryByIso(iso), [iso]);
  const filteredCountries = useMemo(() => filterPhoneCountries(search), [search]);
  const displayNational = formatNationalForDisplay(dial, national);

  const emit = useCallback(
    (nextIso: CountryCode, nextDial: string, nextNational: string) => {
      onChange(composeGuestPhoneDraft(nextDial, nextNational));
    },
    [onChange]
  );

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setSearch("");
  }, []);

  const updatePickerPosition = useCallback(() => {
    const prefix = prefixRef.current;
    if (!prefix) return;
    setPickerPosition(clampPickerPosition(prefix.getBoundingClientRect()));
  }, []);

  const openPicker = useCallback(() => {
    updatePickerPosition();
    setPickerOpen(true);
  }, [updatePickerPosition]);

  const selectCountry = useCallback(
    (item: PhoneCountryOption) => {
      setIso(item.iso);
      setDial(item.dial);
      closePicker();
      emit(item.iso, item.dial, national);
    },
    [closePicker, emit, national]
  );

  useEffect(() => {
    if (!pickerOpen) return;

    updatePickerPosition();
    const onLayout = () => updatePickerPosition();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);

    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [pickerOpen, updatePickerPosition]);

  useEffect(() => {
    if (!pickerOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (prefixRef.current?.contains(target) || pickerRef.current?.contains(target)) {
        return;
      }
      closePicker();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [pickerOpen, closePicker]);

  useEffect(() => {
    if (!pickerOpen) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [pickerOpen]);

  const handlePrefixClick = () => {
    if (pickerOpen) {
      closePicker();
      return;
    }
    openPicker();
  };

  const pickerNode =
    pickerOpen && pickerPosition && mounted ? (
      <div
        ref={pickerRef}
        className="guest-phone-field__picker guest-phone-field__picker--portal"
        role="listbox"
        style={{
          top: pickerPosition.top,
          left: pickerPosition.left,
          width: pickerPosition.width,
          maxHeight: pickerPosition.maxHeight,
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <input
          ref={searchRef}
          type="search"
          className="guest-phone-field__search"
          placeholder="Країна або код (+44, 380…)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ul className="guest-phone-field__list">
          {filteredCountries.length === 0 ? (
            <li className="guest-phone-field__empty">Нічого не знайдено</li>
          ) : (
            filteredCountries.map((item) => (
              <li key={`${item.iso}-${item.dial}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={item.iso === iso}
                  className={`guest-phone-field__option${item.iso === iso ? " is-selected" : ""}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectCountry(item);
                  }}
                >
                  <span className="guest-phone-field__flag">{item.flag}</span>
                  <span className="guest-phone-field__option-name">{item.name}</span>
                  <span className="guest-phone-field__option-dial">+{item.dial}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    ) : null;

  return (
    <>
      <div
        ref={rootRef}
        className={`guest-phone-field${disabled ? " is-disabled" : ""}${pickerOpen ? " is-picker-open" : ""}`}
        id={id}
      >
        <button
          ref={prefixRef}
          type="button"
          className="guest-phone-field__prefix"
          disabled={disabled}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
          aria-label={`Код країни: +${dial}`}
          onClick={handlePrefixClick}
        >
          <span className="guest-phone-field__flag" aria-hidden>
            {country.flag}
          </span>
          <span className="guest-phone-field__code">+{dial}</span>
        </button>

        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          className="guest-phone-field__number"
          disabled={disabled}
          value={displayNational}
          placeholder={dial === "380" ? "Номер телефону" : "Номер телефону"}
          onChange={(event) => {
            const nextNational = parseNationalInput(event.target.value);
            setNational(nextNational);
            emit(iso, dial, nextNational);
          }}
        />
      </div>

      {pickerNode && mounted ? createPortal(pickerNode, document.body) : null}
    </>
  );
}
