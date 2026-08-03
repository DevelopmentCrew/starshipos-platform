#!/usr/bin/env bash
# StarshipOS — ONE-WAY data refresh: Base44 -> AWS RDS (for live testing).
#
# Pulls Base44's CURRENT records and UPSERTS them into RDS: adds new rows AND
# updates ones that changed in Base44 since the last refresh. It is strictly
# one-way and NEVER writes to Base44, so the live app is never touched.
#
# NOTE: this overwrites the AWS copy with Base44's data, so any test records you
# typed into the AWS app are replaced. That's expected — during the build AWS is a
# mirror of Base44. (Deletes in Base44 are NOT propagated; extra stale rows are
# harmless for testing. A full-replace mode can be added for the final cutover.)
#
# WHERE TO RUN: a VPC-connected CloudShell (private subnet + the
# starshipos-dev-api-svc security group) so it can reach the private RDS. Same
# environment as the first data load (run-data-load.sh).
#
# ENV NEEDED: BASE44_APP_ID, and BASE44_TOKEN  (or BASE44_EMAIL + BASE44_PASSWORD).
#
#   export BASE44_APP_ID=698dd71bea4336a2150f8d15
#   export BASE44_TOKEN=<admin bearer token>      # or EMAIL+PASSWORD
#   bash scripts/run-data-refresh.sh
set -euo pipefail
cd "$(dirname "$0")/.."   # -> platform/

echo "== install script deps =="
( cd scripts && npm install --silent --no-audit --no-fund )

SECRET_ID="${DB_SECRET_ID:-starshipos-dev/db-credentials}"
echo "== fetch DB credentials from Secrets Manager ($SECRET_ID) =="
SECRET=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --query SecretString --output text)
export DATABASE_URL=$(python3 - "$SECRET" <<'PY'
import sys, json
s = json.loads(sys.argv[1])
print(f"postgres://{s['username']}:{s['password']}@{s['host']}:{s['port']}/{s['dbname']}")
PY
)
echo "Target DB: $(python3 -c "import json,sys;s=json.loads(sys.argv[1]);print(s['host'],s['dbname'])" "$SECRET")"

echo; echo "== 1/3  Export current data from Base44 =="
node scripts/export-base44.mjs

echo; echo "== 2/3  Upsert into RDS (add new + update changed) =="
IMPORT_MODE=upsert node scripts/import-to-postgres.mjs

echo; echo "== 3/3  Reconcile (Base44 vs RDS row counts + checksums) =="
node scripts/reconcile.mjs

echo; echo "Refresh complete. Review data-export/reconciliation.json"
