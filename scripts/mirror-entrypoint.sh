#!/usr/bin/env bash
# Container entrypoint for the hourly data mirror (Base44 -> RDS, replace mode).
#
# The ECS task injects these as env (DB_* from the db-credentials secret, BASE44_TOKEN
# from the base44-token secret, BASE44_APP_ID + IMPORT_MODE as plain env):
#   DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME  BASE44_APP_ID  BASE44_TOKEN  IMPORT_MODE
#
# It assembles DATABASE_URL (URL-encoding the password), then runs export -> import
# -> reconcile. IMPORT_MODE=replace makes RDS an exact mirror of Base44 each run, so
# any records created only in the AWS test app are removed automatically.
set -euo pipefail
cd /app

echo "== StarshipOS hourly data mirror: Base44 -> RDS (${IMPORT_MODE:-replace}) =="
echo "   $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

if [ -z "${BASE44_TOKEN:-}" ] || [ "${BASE44_TOKEN}" = "REPLACE_ME" ]; then
  echo "ERROR: BASE44_TOKEN is not set (or still the placeholder). Update the"
  echo "       ${AWS_REGION:-eu-west-2} secret 'base44-token' with {\"token\":\"<jwt>\"}."
  exit 1
fi

export DATABASE_URL=$(node -e "const u=encodeURIComponent(process.env.DB_USER||''),p=encodeURIComponent(process.env.DB_PASSWORD||'');process.stdout.write('postgres://'+u+':'+p+'@'+process.env.DB_HOST+':'+(process.env.DB_PORT||'5432')+'/'+process.env.DB_NAME)")

echo "== 1/3  export from Base44 =="
rm -rf data-export
node scripts/export-base44.mjs

echo "== 2/3  ${IMPORT_MODE:-replace} into RDS =="
IMPORT_MODE="${IMPORT_MODE:-replace}" node scripts/import-to-postgres.mjs

echo "== 3/3  reconcile =="
node scripts/reconcile.mjs

echo "== mirror complete $(date -u '+%Y-%m-%dT%H:%M:%SZ') =="
