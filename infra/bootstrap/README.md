# Bootstrap (run once per AWS account)

Creates the things the main stack needs before it can run from CI: the Terraform remote-state bucket + lock table, the GitHub OIDC provider, and the two IAM roles GitHub Actions assumes (`terraform` and `deploy`). Run by a human admin with local AWS credentials, once in the **dev** account and once in the **prod** account.

State here is **local** on purpose (this is what bootstraps the remote state everything else uses). Keep the resulting `terraform.tfstate` somewhere safe; it only references AWS resource ids, no secrets.

## Run

```bash
cd platform/infra/bootstrap

# --- in the DEV account (local creds for dev) ---
terraform init
terraform apply -var-file=dev.tfvars

# --- in the PROD account (switch to prod creds first) ---
terraform init -reconfigure
terraform apply -var-file=prod.tfvars
```

Because dev and prod are **separate accounts**, run with each account's credentials in turn (different `AWS_PROFILE` per account is easiest).

## After apply

Terraform prints `github_secrets_to_set`. Put those ARNs into the GitHub repo (`DevelopmentCrew/starshipos-platform`) as **environment** secrets:

- `dev` environment → the dev account's `AWS_TERRAFORM_ROLE_ARN` and `AWS_DEPLOY_ROLE_ARN`
- `prod` environment → the prod account's ARNs (and add required reviewers so prod deploys need approval)

Also add repo secrets for the reconcile workflow: `BASE44_APP_ID`, `BASE44_EMAIL`, `BASE44_PASSWORD` (an admin export account).

## Security model

The IAM roles are broad on *what* they can do but tightly locked on *who* can assume them: only GitHub Actions running in `DevelopmentCrew/starshipos-platform` (and, for deploy, only from the protected `dev`/`prod` environment) can assume them, via OIDC. No AWS keys are ever stored in GitHub.

## Still manual (can't be coded here)

- **Route53 hosted zone** for `starshipgroup.co.uk`, then delegate the domain's nameservers to AWS at your registrar. (Confirmed: DNS in Route53.)
- **SES production access** request, so invite emails can send to any address, not just verified ones.

See `../BOOTSTRAP.md` for the full runbook.
