# Remote state in S3 with a DynamoDB lock table.
# The state bucket and lock table are bootstrapped once, out of band, before the
# first `terraform init` (see platform/README.md > Bootstrap). Per-environment
# values are passed with -backend-config, e.g.:
#
#   terraform init \
#     -backend-config="bucket=starshipos-tfstate-prod" \
#     -backend-config="dynamodb_table=starshipos-tflock-prod" \
#     -backend-config="key=starshipos/prod/terraform.tfstate" \
#     -backend-config="region=eu-west-2"

terraform {
  backend "s3" {
    encrypt = true
  }
}
