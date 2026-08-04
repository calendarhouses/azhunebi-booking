# Cutover runbook — GAS/Sheets → Supabase + Vercel

## Preconditions

1. Run SQL in Supabase SQL editor: [`supabase/migrations/20260804_prod_schema.sql`](../supabase/migrations/20260804_prod_schema.sql)
2. Env on Vercel + local:
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (Vercel Cron Authorization)
   - `DATA_SOURCE=gas` until cutover
   - `DUAL_WRITE_SUPABASE=true` during Phase 2
3. Final snapshot: `POST /api/migrate-db` with Bearer secret
4. Checksums: `GET /api/internal/checksum?compareGas=1`

## Phase checklist

### Phase 2 (dual-write, still GAS primary)

```bash
# .env / Vercel
DATA_SOURCE=gas
DUAL_WRITE_SUPABASE=true
```

- Run 48–72h
- Daily: `POST /api/internal/reconcile` (also cron 03:30)
- `checksum?compareGas=1` → `diff` near zero

### Phase 3 staging (Supabase primary)

```bash
DATA_SOURCE=supabase
GAS_MIRROR_WRITES=true
MAINTENANCE_MODE=true   # optional for first test
```

Smoke:

- [ ] login / adminBoot
- [ ] adminInitData &lt; 3s
- [ ] create / edit / delete booking
- [ ] public init + pending review
- [ ] Telegram approve/reject
- [ ] payment-lifecycle dry run
- [ ] ical sync one room
- [ ] SMS settings read

Rollback: `DATA_SOURCE=gas` (&lt;2 min).

### Phase 4 production cutover

1. `MAINTENANCE_MODE=true`
2. Drain ~2 min
3. `POST /api/migrate-db` + `checksum?compareGas=1` (diff ≈ 0)
4. `DATA_SOURCE=supabase`, `GAS_MIRROR_WRITES=false`, `DUAL_WRITE_SUPABASE=false`
5. Smoke list above
6. `MAINTENANCE_MODE=false`
7. Watch Vercel + Supabase logs 24–48h

### Phase 5 decommission

1. Sheets → File → Make a copy (archive); set sheet sharing read-only
2. Disable Apps Script web app deploy
3. Remove `NEXT_PUBLIC_GAS_URL` from Vercel (optional; uploadFile needs GAS or external URLs until Storage)
4. Keep `migrate-db` / `reconcile` as historical tools

## Auth note

`teamMembers` is stripped from `adminInitData`. On first Supabase boot, owner is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (or defaults). Set these to the real owner credentials before cutover, or save `teamMembers` into settings manually after exporting from Sheets.

## Reverse ETL

See [REVERSE_ETL.md](./REVERSE_ETL.md) if rollback to Sheets is required.
