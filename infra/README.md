# StarshipOS infrastructure (Terraform)

AWS baseline for the StarshipOS platform: VPC, RDS Postgres, S3 + CloudFront (frontend), Cognito + SES (auth/invites), and ECS Fargate + ALB (API). Region `eu-west-2` (London). Two environments: `dev` and `prod`.

## Layout

```
infra/terraform/
  versions.tf        providers (aws, aws.us_east_1 for CloudFront/ACM)
  backend.tf         S3 remote state + DynamoDB lock (per-env via -backend-config)
  variables.tf       inputs
  main.tf            wires the modules together
  outputs.tf         endpoints, ids, ARNs
  environments/      dev.tfvars, prod.tfvars
  modules/
    network/         VPC, public/private subnets, NAT, routes
    database/        RDS Postgres 16, security group, Secrets Manager creds
    storage/         S3 frontend + uploads buckets (private, encrypted)
    cdn/             CloudFront (OAC) + ACM + Route53 for the frontend
    auth/            Cognito user pool/client + SES branded sender
    api/             ECR, ECS Fargate service, ALB, ACM + Route53
```

## Bootstrap (once per environment, before the first `init`)

Remote state needs a bucket and a lock table that exist *before* Terraform runs. Create them out of band:

```bash
aws s3api create-bucket --bucket starshipos-tfstate-dev \
  --region eu-west-2 --create-bucket-configuration LocationConstraint=eu-west-2
aws s3api put-bucket-versioning --bucket starshipos-tfstate-dev \
  --versioning-configuration Status=Enabled
aws dynamodb create-table --table-name starshipos-tflock-dev \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region eu-west-2
```

Repeat with `-prod`. Also required before apply: a Route53 hosted zone for `starshipgroup.co.uk`, and an SES account moved out of the sandbox (or verified recipients) so invite emails send.

## Usage

```bash
make init ENV=dev
make plan ENV=dev
make apply ENV=dev
```

## CI/CD

`.github/workflows/infra.yml` runs fmt + validate + plan on every PR touching `infra/`, and applies on merge to `main` (prod gated by a protected-environment reviewer approval). AWS access is via GitHub OIDC federation — no long-lived keys. Set repo secret `AWS_TERRAFORM_ROLE_ARN` to the role GitHub assumes.

## Notes

- The API task definition ships a `bootstrap` image tag; the real image is pushed and the service updated by `api-deploy.yml`. Terraform ignores that drift on purpose.
- RDS has `deletion_protection = true` and takes a final snapshot — deliberate for live data.
- Nothing here touches Base44. This stack stands up entirely in parallel; cutover is a later, separate step.
