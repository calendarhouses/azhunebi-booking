# Reverse ETL — Supabase → Google Sheets (emergency rollback)

Use only if `DATA_SOURCE` must return to `gas` and Sheets drifted behind Supabase.

## Preferred rollback (no reverse ETL)

If dual-write / mirror was healthy:

1. Set `DATA_SOURCE=gas`
2. Run `POST /api/internal/reconcile` is **GAS→Supabase** only — do **not** use it for reverse
3. If Sheets is still authoritative from mirror (`GAS_MIRROR_WRITES=true` during Phase 3), just switch flag

## Full reverse (Sheets empty / corrupt)

1. Export from Supabase (SQL editor or script):

```sql
SELECT * FROM bookings;
SELECT * FROM rooms;
SELECT key, value FROM settings WHERE key <> '__keepalive';
SELECT * FROM guest_profiles;
```

2. Map rows back to GAS API shapes:
   - bookings: use `lib/db/mappers.ts` `dbBookingToApi` (or call app with `DATA_SOURCE=supabase` then `getAllBookings`)
   - Push via GAS `createBooking` with `importId` / existing `id` (skipped if exists — may need delete-first)

3. Safer path: temporary Node script that:
   - reads Supabase via service role
   - POSTs each booking to `NEXT_PUBLIC_GAS_URL` as admin `createBooking` with full fields + `id`
   - POSTs `saveSettings` with settings blob + `roomsList`

4. After Sheets catch-up: `DATA_SOURCE=gas`, re-run `migrate-db` later when ready to leave Sheets again.

## Do not

- Force-push both directions at once
- Run reverse during live public traffic without `MAINTENANCE_MODE=true`
