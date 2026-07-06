# StarshipOS API

Node/TypeScript (Fastify) backend that replaces Base44's hosted backend. Talks to RDS Postgres, verifies Cognito JWTs, and (over Phases 1–4) absorbs the old Base44 functions: entity CRUD, Xero sync, AI extraction, reference generation, CVR/HSE/GSD/training logic.

## Status: scaffold

What's here:
- Fastify server with CORS and structured logging (`src/server.ts`)
- Config from env / Secrets Manager (`src/config.ts`)
- Postgres pool + healthcheck (`src/db.ts`)
- Cognito JWT verification via JWKS (`src/auth.ts`)
- `/health` (ALB check) and `/health/ready` (DB check) (`src/routes/health.ts`)
- Generic entity read endpoints mirroring the Base44 list/get shape (`src/routes/entities.ts`)
- Dockerfile (multi-stage, non-root, healthcheck)

Deliberately **not** done yet (tracked in the migration plan):
- **Authorization / RLS.** `scopeFilter` currently returns admin-all / deny-by-default. The real per-user scoping (role, accessible developments, module access, customer org) lands in Phase 2 — this is the permissions rebuild we're doing properly this time.
- **Table registry.** `entities.ts` uses a small placeholder allow-list; it gets generated from `db/entities.json` (all 149 tables).
- Writes (create/update/delete), the ported business functions, and file/upload endpoints.

## Local dev

```bash
cp .env.example .env      # fill in DATABASE_URL and Cognito values
npm install
npm run dev               # tsx watch on :3000
curl localhost:3000/health
```

## Build / container

```bash
npm run build             # tsc -> dist/
docker build -t starshipos-api .
```

The image is built and deployed by `.github/workflows/api-deploy.yml` (ECR + ECS).
