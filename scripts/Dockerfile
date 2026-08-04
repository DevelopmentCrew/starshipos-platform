# StarshipOS data mirror — runs the Base44 -> RDS refresh (replace mode) as a
# one-shot Fargate task, fired hourly by EventBridge. Build context = repo root:
#   docker build -f scripts/Dockerfile -t <image> .
FROM node:20-slim

WORKDIR /app

# Install script deps first (better layer caching).
COPY scripts/package.json ./scripts/package.json
RUN cd scripts && npm install --omit=dev --no-audit --no-fund

# The scripts + the entity/schema definitions they read.
COPY scripts/ ./scripts/
COPY db/ ./db/

RUN chmod +x scripts/mirror-entrypoint.sh

# The entrypoint assembles DATABASE_URL from the injected DB_* secrets and runs
# export -> replace-import -> reconcile. BASE44_TOKEN / BASE44_APP_ID come from env.
ENTRYPOINT ["bash", "scripts/mirror-entrypoint.sh"]
