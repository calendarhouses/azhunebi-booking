# Soft decommission notes

When `DATA_SOURCE=supabase`:

- Runtime no longer requires `NEXT_PUBLIC_GAS_URL` except for `uploadFile` (Drive) and optional `GAS_MIRROR_WRITES`.
- `/api/gas` remains the public API facade (name kept for UI compatibility) and dispatches to Supabase DAL.
- Direct callers (`cronDigest`, `ical/sync`, payment helpers) go through `lib/gas-api` server path → `handleBackendRequest`.

To finish decommission later:

1. Move uploads to Supabase Storage and implement `uploadFile` in DAL.
2. Rename `/api/gas` → `/api/backend` (update `adminApi` / `gas-api` client base).
3. Delete Apps Script project deploy; archive the spreadsheet.
