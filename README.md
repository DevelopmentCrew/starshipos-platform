# StarshipOS Platform (own-infrastructure migration)

Migrating StarshipOS off Base44's backend onto our own AWS stack. See
`../StarshipOS-Migration-Plan.md` for the full plan. One channel: all changes go
through the GitHub repo.

## Target stack (confirmed)
- Frontend: existing React app (from GitHub), hosted on S3 + CloudFront on os.starshipgroup.co.uk
- API/backend: Node/TypeScript service on AWS
- Database: managed PostgreSQL (Amazon RDS to start)
- Auth: AWS Cognito, with branded invite emails sent via Amazon SES from our own domain
- Storage: Amazon S3 (presigned URLs / served on our domain)
- AI: backend calls the LLM provider directly (replaces Base44 InvokeLLM)
- CI/CD: GitHub Actions; infra as code (Terraform/CDK)

## Repo layout (this folder)
- `db/schema-gen.py`     generates Postgres DDL from the Base44 entity snapshot
- `db/schema.sql`        generated Postgres schema (149 tables)  <-- review this
- `db/mapping-report.md` entity -> table mapping, column/enum/FK notes
- `db/entities.json`     entity <-> table name list (used by the exporter)
- `db/reconciliation-baseline.md` the data round-trip proof + reconciliation procedure
- `scripts/export-base44.mjs` exports all Base44 records to `data-export/*.json`
- `scripts/reconcile.mjs` builds the reconciliation report (counts, checksums, financial totals)
- `infra/`               Terraform baseline (VPC, RDS, S3+CloudFront, Cognito+SES, ECS+ALB)
- `.github/workflows/`   CI/CD: infra plan/apply, api build/deploy, nightly reconcile
- `Makefile`             common tasks (init/plan/apply/export/reconcile/schema)
- `api/`                 (Phase 1/4) backend service - to build

## Phase 0 status
- [x] Terraform IaC baseline — network, database, storage, cdn, auth, api modules (11 files, all parse-clean)
- [x] Per-environment config (dev/prod tfvars), S3 remote state + DynamoDB lock
- [x] GitHub Actions: `infra.yml` (fmt/validate/plan on PR, gated apply on main via OIDC), `api-deploy.yml` (ECR build + ECS deploy), `reconcile.yml` (nightly export + reconcile)
- [x] Bootstrap + usage docs (`infra/README.md`)
- [ ] Bootstrap state buckets/lock tables + Route53 zone + SES out-of-sandbox, then first `terraform apply` to a dev account
- [ ] Wire GitHub OIDC roles (`AWS_TERRAFORM_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN`)

## Phase 1 status
- [x] Postgres schema generated from the 149-entity snapshot (149 tables, 1,762 columns)
- [x] Entity->table mapping report
- [x] Data-export script (skeleton; confirm Base44 REST path/auth before real run)
- [ ] Regenerate schema from a FRESH live entity snapshot (the bundled snapshot is
      2026-06-11 and predates recent field/RLS changes, e.g. Employee.company_email)
- [ ] Load a copy of exported data into a throwaway Postgres and reconcile counts
- [ ] Add relational refinements: enforce chosen FKs post-cleanse, split large jsonb
      arrays into child tables where it helps queries (e.g. PO work_items, comments)

## How to run
```bash
# 1. (re)generate the schema from the entity snapshot
python3 db/schema-gen.py

# 2. export live data (set creds first)
export BASE44_APP_ID=698dd71bea4336a2150f8d15
export BASE44_API_KEY=***
node scripts/export-base44.mjs

# 3. create the schema in a local/RDS Postgres
psql "$DATABASE_URL" -f db/schema.sql
```

## Notes / decisions still to make
- FKs are documented in the mapping report but NOT enforced yet (Base44 data can
  contain dangling references; enforce after a cleansing pass).
- Enums are stored as `text` with the allowed values in a comment; we can promote
  to CHECK constraints or native enums once values are confirmed stable.
- Large array/object fields are `jsonb` for a faithful first import; we selectively
  normalise into child tables where query patterns justify it.
