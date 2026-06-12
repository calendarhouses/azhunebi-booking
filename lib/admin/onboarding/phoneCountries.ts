import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

export type PhoneCountryOption = {
  iso: CountryCode;
  dial: string;
  name: string;
  flag: string;
  searchText: string;
};

function isoToFlag(iso: string): string {
  const code = iso.toUpperCase();
  if (code.length !== 2) return "🏳️";
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  );
}

let countriesCache: PhoneCountryOption[] | null = null;

export function getAllPhoneCountries(): PhoneCountryOption[] {
  if (countriesCache) return countriesCache;

  const displayUk = new Intl.DisplayNames(["uk"], { type: "region" });
  const displayEn = new Intl.DisplayNames(["en"], { type: "region" });

  countriesCache = getCountries()
    .map((iso) => {
      const dial = getCountryCallingCode(iso);
      const nameUk = displayUk.of(iso) || iso;
      const nameEn = displayEn.of(iso) || iso;
      const flag = isoToFlag(iso);
      const searchText = [
        iso,
        nameUk,
        nameEn,
        dial,
        `+${dial}`,
        `+ ${dial}`,
      ]
        .join(" ")
        .toLowerCase();

      return { iso, dial, name: nameUk, flag, searchText };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));

  return countriesCache;
}

export const PHONE_COUNTRIES_BY_DIAL_LENGTH = getAllPhoneCountries().sort(
  (a, b) => b.dial.length - a.dial.length
);

export function getPhoneCountryByIso(iso: CountryCode): PhoneCountryOption {
  const found = getAllPhoneCountries().find((c) => c.iso === iso);
  if (found) return found;
  return getAllPhoneCountries().find((c) => c.iso === "UA")!;
}

export function getPhoneCountryByDial(dial: string, preferredIso?: CountryCode): PhoneCountryOption {
  const matches = getAllPhoneCountries().filter((c) => c.dial === dial);
  if (preferredIso) {
    const preferred = matches.find((c) => c.iso === preferredIso);
    if (preferred) return preferred;
  }
  if (matches.length) return matches[0];
  return getPhoneCountryByIso("UA");
}

export function filterPhoneCountries(query: string): PhoneCountryOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return getAllPhoneCountries();

  const digits = q.replace(/\D/g, "");
  const withPlus = q.startsWith("+") ? q.slice(1).replace(/\D/g, "") : "";

  return getAllPhoneCountries().filter((country) => {
    if (country.searchText.includes(q)) return true;
    if (withPlus && country.dial.startsWith(withPlus)) return true;
    if (digits && country.dial.startsWith(digits)) return true;
    if (q.startsWith("+") && `+${country.dial}`.startsWith(q.replace(/\s/g, ""))) return true;
    return false;
  });
}
