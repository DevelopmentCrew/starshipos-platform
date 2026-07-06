# Dev stack — live endpoints (AWS account 892337384679, eu-west-2)

Stood up 2026-07-04 via Terraform. Dev uses AWS default domains (no custom DNS). Nothing here is secret except the DB password, which stays in Secrets Manager (only the ARN is recorded).

| Thing | Value |
|---|---|
| VPC | `vpc-0654531eee92d4796` |
| RDS Postgres | `starshipos-dev-pg.cpvbsgxhsppv.eu-west-2.rds.amazonaws.com:5432` (private subnets, db `starshipos`, user `starshipos_admin`) |
| DB credentials | Secrets Manager `starshipos-dev/db-credentials` (ARN `...:secret:starshipos-dev/db-credentials-hqgAnM`) |
| Cognito user pool | `eu-west-2_13HrsjI4H` |
| Cognito app client | `670t3ll2gn4qsmdsb67iruqg4u` |
| API ECR repo | `892337384679.dkr.ecr.eu-west-2.amazonaws.com/starshipos-dev-api` |
| API ALB (HTTP) | `starshipos-dev-api-2024109960.eu-west-2.elb.amazonaws.com` |
| Frontend bucket | `starshipos-dev-frontend` |
| Frontend CloudFront | `d1w15g135zlze.cloudfront.net` |

Bootstrap (state bucket, lock table, OIDC roles): `starshipos-tfstate-dev`, `starshipos-tflock-dev`, roles `starshipos-terraform-dev` / `starshipos-deploy-dev`.

## Reaching RDS

RDS is private and its security group only admits the API service SG (`starshipos-dev-api-svc`). To run schema/import/psql against it, use a **VPC-enabled CloudShell** environment placed in a private subnet with the `starshipos-dev-api-svc` security group attached — then the DB accepts the connection with no security-group changes.
