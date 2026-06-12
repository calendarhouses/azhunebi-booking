import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import {
  getPhoneCountryByIso,
  PHONE_COUNTRIES_BY_DIAL_LENGTH,
  type PhoneCountryOption,
} from "./phoneCountries";

export type ParsedGuestPhone = {
  iso: CountryCode;
  dial: string;
  national: string;
  country: PhoneCountryOption;
};

function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

/** Лише цифри під час вводу — нуль не забираємо. */
export function parseNationalInput(raw: string): string {
  return digitsOnly(raw).slice(0, 15);
}

/**
 * Нормалізація перед збереженням: libphonenumber прибирає транк 0 для UA (+380),
 * але залишає валідний 0 там, де він частина номера (напр. деякі країни).
 */
export function normalizeNationalForSave(
  iso: CountryCode,
  dial: string,
  national: string
): string {
  const digits = digitsOnly(national);
  if (!digits) return "";

  const parsed = parsePhoneNumberFromString(`+${dial}${digits}`, iso);
  if (parsed) {
    return parsed.nationalNumber;
  }

  return digits;
}

export function parseStoredGuestPhone(value: string): ParsedGuestPhone {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    const country = getPhoneCountryByIso("UA");
    return { iso: country.iso, dial: country.dial, national: "", country };
  }

  const e164 = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed?.country) {
    const country = getPhoneCountryByIso(parsed.country);
    return {
      iso: parsed.country,
      dial: parsed.countryCallingCode,
      national: parsed.nationalNumber,
      country,
    };
  }

  const digits = digitsOnly(trimmed);
  for (const country of PHONE_COUNTRIES_BY_DIAL_LENGTH) {
    if (digits.startsWith(country.dial)) {
      return {
        iso: country.iso,
        dial: country.dial,
        national: digits.slice(country.dial.length),
        country,
      };
    }
  }

  const fallback = getPhoneCountryByIso("UA");
  return {
    iso: fallback.iso,
    dial: fallback.dial,
    national: digits,
    country: fallback,
  };
}

export function isValidGuestPhone(iso: CountryCode, dial: string, national: string): boolean {
  const digits = digitsOnly(national);
  if (!digits) return false;
  return isValidPhoneNumber(`+${dial}${digits}`, iso);
}

export function composeGuestPhoneDraft(dial: string, national: string): string {
  const digits = parseNationalInput(national);
  if (!digits) return "";
  return `+${dial}${digits}`;
}

export function formatGuestPhoneForSave(
  iso: CountryCode,
  dial: string,
  national: string
): string {
  if (!isValidGuestPhone(iso, dial, national)) return "";
  const digits = digitsOnly(national);
  const parsed = parsePhoneNumberFromString(`+${dial}${digits}`, iso);
  if (parsed?.isValid()) return parsed.format("E.164");
  return `+${dial}${normalizeNationalForSave(iso, dial, national)}`;
}

/** Пробіли для читабельності, без видалення ведучого 0. */
export function formatNationalForDisplay(dial: string, national: string): string {
  const d = parseNationalInput(national);
  if (!d) return "";

  if (dial === "380") {
    if (d.length <= 3) return d;
    if (d.startsWith("0")) {
      const chunks = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
      return chunks.join(" ");
    }
    const chunks = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
    return chunks.join(" ");
  }

  return d.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

/** @deprecated використовуй parseNationalInput */
export function parseDisplayNationalInput(_dial: string, display: string): string {
  return parseNationalInput(display);
}
