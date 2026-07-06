# StarshipOS — AWS bootstrap runbook

Everything Terraform can't create for itself, done once per environment before the first `terraform apply`. These are the account-side actions only an AWS account admin can do. Do `dev` first, prove it, then repeat for `prod`.

Region throughout: **eu-west-2** (London). Replace `dev` with `prod` for the prod pass.

## 0. Prerequisites

- An AWS account (or a `dev` and a `prod` account — separate accounts is cleaner than one shared).
- AWS CLI logged in as an admin, or console access.
- Control of DNS for `starshipgroup.co.uk` (to delegate or host the zone in Route53).

## 1. Terraform remote state (bucket + lock table)

State lives in S3 with a DynamoDB lock so two runs can't collide.

```bash
aws s3api create-bucket --bucket starshipos-tfstate-dev \
  --region eu-west-2 --create-bucket-configuration LocationConstraint=eu-west-2
aws s3api put-bucket-versioning --bucket starshipos-tfstate-dev \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket starshipos-tfstate-dev \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws dynamodb create-table --table-name starshipos-tflock-dev \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region eu-west-2
```

## 2. Route53 hosted zone

The `cdn`, `auth` and `api` modules look up a hosted zone for `starshipgroup.co.uk` and write records into it. If the domain isn't already in Route53:

```bash
aws route53 create-hosted-zone --name starshipgroup.co.uk \
  --caller-reference starshipos-$(date +%s)
```

Then at your current DNS registrar, point the domain's nameservers at the four NS records Route53 returns. (If you'd rather keep DNS where it is, we switch the modules to create just the specific CNAME/A records at your provider instead — tell me and I'll adjust.)

## 3. Amazon SES (branded invite sender)

Cognito sends invite/account emails through SES from `no-reply@starshipgroup.co.uk`. Terraform creates the domain identity and DKIM records, but two things are account-level:

1. **Move SES out of the sandbox.** New SES accounts can only email verified addresses. Request production access:
   `SES console > Account dashboard > Request production access` (state the use: transactional invite/account emails to staff). Approval is usually within 24h.
2. After the first `terraform apply` creates the SES identity + DKIM records, confirm the domain shows **Verified** in the SES console (DKIM propagation can take up to an hour).

## 4. GitHub OIDC roles (no long-lived keys)

CI authenticates to AWS by federating GitHub's OIDC token to an IAM role — nothing secret is stored in GitHub. Create the identity provider once per account:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Then create two roles with a trust policy scoped to this repo (replace `ORG/REPO`):

- **`starshipos-terraform-dev`** — permissions to manage the stack (broad for infra; scope down later). Used by `infra.yml`.
- **`starshipos-deploy-dev`** — ECR push + ECS update + `iam:PassRole` for the task roles. Used by `api-deploy.yml`.

Trust policy condition (both roles):

```json
{
  "Condition": {
    "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
    "StringLike": { "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:*" }
  }
}
```

Put the role ARNs into GitHub repo secrets: `AWS_TERRAFORM_ROLE_ARN`, `AWS_DEPLOY_ROLE_ARN`. Also add `BASE44_APP_ID`, `BASE44_EMAIL`, `BASE44_PASSWORD` for the reconcile workflow (admin export account).

## 5. First apply

```bash
cd platform
make init ENV=dev
make plan ENV=dev      # read the plan carefully
make apply ENV=dev
```

Expect: VPC, RDS Postgres (a few minutes), S3 buckets, CloudFront (10–20 min to deploy), Cognito pool, ECS cluster + ALB. The API service will run the `bootstrap` placeholder image until the first real deploy.

## 6. Smoke checks after apply

- `terraform output db_endpoint` resolves; you can connect from a bastion/session-manager in the VPC.
- CloudFront domain serves (will 404 until frontend files are uploaded — expected).
- Cognito pool exists with self-signup disabled.
- SES domain identity is Verified.

## 7. Then

Hand back to the pipeline: load a data copy into RDS and run the reconciliation (task #52), and deploy the first API image. Nothing above touches Base44 — the live app is untouched throughout.

---

### What I need from you to proceed

Just the go-ahead on a few choices and I'll tailor the rest:

1. **One AWS account or separate dev/prod accounts?** (separate is recommended)
2. **Route53 for DNS, or keep DNS at your current registrar** and have Terraform create individual records there?
3. **The GitHub repo** the platform will live in (`ORG/REPO`) so the OIDC trust policy is scoped correctly.
