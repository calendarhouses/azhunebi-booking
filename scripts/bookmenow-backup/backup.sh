#!/usr/bin/env bash
# Read-only backup of BookMeNow serviceOrders. Does NOT modify remote data.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${BOOKMENOW_ENV:-$ROOT/.env.bookmenow.local}"
OUT_DIR="${BOOKMENOW_BACKUP_DIR:-$ROOT/scripts/bookmenow-backup/data}"
STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$OUT_DIR/$STAMP"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

TENANT="${BOOKMENOW_TENANT_NAME:-}"
TOKEN="${BOOKMENOW_API_TOKEN:-}"

if [[ -z "$TENANT" || -z "$TOKEN" ]]; then
  echo "Missing BOOKMENOW_TENANT_NAME / BOOKMENOW_API_TOKEN"
  echo "Create $ENV_FILE (gitignored) or export env vars."
  exit 1
fi

mkdir -p "$RUN_DIR/chunks"
RAW_DIR="$RUN_DIR/chunks"

fetch() {
  local qs="$1"
  local out="$2"
  curl -sS --fail-with-body \
    -H "content-type: application/json" \
    -H "x-tenant-name: $TENANT" \
    -H "x-api-token: $TOKEN" \
    "https://api.bookmenow.pro/v1/external/serviceOrders?$qs" \
    -o "$out"
}

echo "BookMeNow READ-ONLY backup → $RUN_DIR"
echo "Tenant: $TENANT"

YEAR_FROM="${BOOKMENOW_YEAR_FROM:-2020}"
YEAR_TO="${BOOKMENOW_YEAR_TO:-2028}"

for year in $(seq "$YEAR_FROM" "$YEAR_TO"); do
  for kind in createdAt serviceDate; do
    if [[ "$kind" == "createdAt" ]]; then
      qs="createdAtFrom=${year}-01-01&createdAtTo=${year}-12-31"
    else
      qs="serviceDateFrom=${year}-01-01&serviceDateTo=${year}-12-31"
    fi
    out="$RAW_DIR/${kind}-${year}.json"
    echo "  GET $qs"
    if fetch "$qs" "$out"; then
      count=$(python3 -c "import json; d=json.load(open(r'''$out''')); print(len(d) if isinstance(d,list) else 0)")
      echo "    → $count rows"
    else
      echo "    → FAILED"
    fi
    sleep 0.25
  done
done

export BMN_RUN_DIR="$RUN_DIR"
export BMN_TENANT="$TENANT"

python3 << 'PY'
import json, glob, os
from collections import Counter
from datetime import datetime, timezone

run_dir = os.environ["BMN_RUN_DIR"]
tenant = os.environ["BMN_TENANT"]
raw_dir = os.path.join(run_dir, "chunks")
by_id = {}
chunk_stats = []

for path in sorted(glob.glob(os.path.join(raw_dir, "*.json"))):
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        chunk_stats.append({"file": os.path.basename(path), "error": str(e)})
        continue
    if not isinstance(data, list):
        chunk_stats.append({
            "file": os.path.basename(path),
            "error": "not a list",
            "sample": str(data)[:200],
        })
        continue
    chunk_stats.append({"file": os.path.basename(path), "count": len(data)})
    for row in data:
        oid = str(row.get("_id") or row.get("id") or "")
        if not oid:
            continue
        prev = by_id.get(oid)
        if prev is None or str(row.get("updatedAt") or "") >= str(prev.get("updatedAt") or ""):
            by_id[oid] = row

orders = sorted(
    by_id.values(),
    key=lambda r: (str(r.get("serviceDateFrom") or ""), str(r.get("_id") or "")),
)

full_path = os.path.join(run_dir, "serviceOrders.full.json")
with open(full_path, "w", encoding="utf-8") as f:
    json.dump(orders, f, ensure_ascii=False, indent=2)

summary = []
for r in orders:
    client = r.get("client") or {}
    payments = r.get("payments") or []
    summary.append({
        "id": r.get("_id"),
        "orderNumber": r.get("orderNumber") or r.get("sequenceId"),
        "status": r.get("status"),
        "checkIn": r.get("serviceDateFrom"),
        "checkOut": r.get("serviceDateTo"),
        "roomId": r.get("roomId"),
        "roomName": r.get("roomName"),
        "name": f"{client.get('firstName') or ''} {client.get('lastName') or ''}".strip(),
        "phone": client.get("phoneNumber"),
        "email": client.get("email"),
        "guestsAdults": (r.get("guests") or {}).get("adults"),
        "guestsChildren": (r.get("guests") or {}).get("children"),
        "totalPrice": r.get("totalPrice") or r.get("finalPrice") or r.get("overallPrice"),
        "paidAmount": r.get("paidAmount"),
        "unpaidAmount": r.get("unpaidAmount"),
        "paymentsCount": len(payments) if isinstance(payments, list) else 0,
        "paymentsSum": sum(float(p.get("amount") or 0) for p in payments) if isinstance(payments, list) else 0,
        "comment": r.get("comment") or "",
        "createdAt": r.get("createdAt"),
        "createdSource": r.get("createdSource"),
    })

summary_path = os.path.join(run_dir, "serviceOrders.summary.json")
with open(summary_path, "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2)

csv_path = os.path.join(run_dir, "serviceOrders.summary.csv")
cols = list(summary[0].keys()) if summary else [
    "id", "orderNumber", "status", "checkIn", "checkOut", "roomId", "roomName",
    "name", "phone", "email", "guestsAdults", "guestsChildren", "totalPrice",
    "paidAmount", "unpaidAmount", "paymentsCount", "paymentsSum", "comment",
    "createdAt", "createdSource",
]

def esc(v):
    s = "" if v is None else str(v)
    if any(c in s for c in [",", '"', "\n", "\r"]):
        return '"' + s.replace('"', '""') + '"'
    return s

with open(csv_path, "w", encoding="utf-8") as f:
    f.write(",".join(cols) + "\n")
    for row in summary:
        f.write(",".join(esc(row.get(c)) for c in cols) + "\n")

status_counts = Counter(str(r.get("status") or "") for r in orders)
room_counts = Counter(str(r.get("roomName") or "") for r in orders)
meta = {
    "tenant": tenant,
    "backedUpAt": datetime.now(timezone.utc).isoformat(),
    "mode": "read-only",
    "uniqueOrders": len(orders),
    "chunkStats": chunk_stats,
    "statusCounts": dict(status_counts),
    "roomCounts": dict(room_counts),
    "files": {
        "full": "serviceOrders.full.json",
        "summaryJson": "serviceOrders.summary.json",
        "summaryCsv": "serviceOrders.summary.csv",
        "chunks": "chunks/",
    },
}
manifest_path = os.path.join(run_dir, "manifest.json")
with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)

print("")
print(f"OK unique orders: {len(orders)}")
print(f"  full:     {full_path}")
print(f"  summary:  {summary_path}")
print(f"  csv:      {csv_path}")
print(f"  manifest: {manifest_path}")
print("Statuses:", dict(status_counts))
PY

echo ""
echo "Done. Backup is local only — BookMeNow was not modified."
