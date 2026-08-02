/**
 * Guest CRM rules (do not violate — see Aug 1 boot outage):
 *
 * 1. Never store guestProfiles (or any large CRM map) in Settings cells that ride on init.
 * 2. Never create/touch GuestProfiles (or other optional CRM sheets) from ensureSheetsExist / getSheet.
 * 3. Guest ratings/notes load lazy: only on Guests view or booking-drawer open.
 * 4. Autocomplete filters already-loaded slim bookings client-side (no per-keystroke GAS).
 * 5. Payment auto-confirm status is client-only — never part of boot payload.
 *
 * This file is documentation-only for agents and reviewers.
 */
export const GUEST_CRM_BOOT_RULES = {
  neverOnAdminInit: true,
  neverOnPublicInit: true,
  neverInEnsureSheetsExist: true,
  storage: "dedicated GuestProfiles sheet or equivalent — not Settings JSON cell",
} as const;
