#!/usr/bin/env bash
# StarshipOS — first data load into RDS. Run from ~/platform in a VPC-connected
# CloudShell (private subnet + the starshipos-dev-api-svc security group).
#
# Needs in the environment: BASE44_APP_ID, BASE44_EMAIL, BASE44_PASSWORD.
# Pulls DB credentials from Secrets Manager itself.
set -euo pipefail
cd "$(dirname "$0")/.."   # -> platform/

SECRET_ID="${DB_SECRET_ID:-starshipos-dev/db-credentials}"
echo "Fetching DB credentials from Secrets Manager ($SECRET_ID)…"
SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --query SecretString --output text)
export DATABASE_URL=$(python3 - "$SECRET" <<'PY'
import sys, json
s = json.loads(sys.argv[1])
print(f"postgres://{s['username']}:{s['password']}@{s['host']}:{s['port']}/{s['dbname']}")
PY
)
echo "DB target: $(python3 -c "import json,sys;s=json.loads(sys.argv[1]);print(s['host'],s['dbname'])" "$SECRET")"

echo; echo "== 1/4  Create schema (149 tables) =="
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
echo "Tables now in DB:"
psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"

echo; echo "== 2/4  Export from Base44 =="
node scripts/export-base44.mjs

echo; echo "== 3/4  Import into Postgres =="
node scripts/import-to-postgres.mjs

echo; echo "== 4/4  Reconcile (source vs Postgres) =="
node scripts/reconcile.mjs

echo; echo "Done. See data-export/reconciliation.json"
