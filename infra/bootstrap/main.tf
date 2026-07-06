# StarshipOS — per-account bootstrap.
#
# Chicken-and-egg: the main stack authenticates from CI via GitHub OIDC and keeps
# its state in S3, but the OIDC role and the state bucket don't exist yet. This
# tiny config creates exactly those prerequisites, and is run ONCE per account by
# a human admin with local credentials (its own state is local — commit nothing
# sensitive). After this, everything else runs through CI with no long-lived keys.
#
#   cd platform/infra/bootstrap
#   terraform init
#   terraform apply -var-file=dev.tfvars     # in the dev account
#   terraform apply -var-file=prod.tfvars    # in the prod account (separate creds)

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Local state on purpose — this bootstraps the remote state everything else uses.
  backend "local" {}
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "StarshipOS"
      Environment = var.environment
      ManagedBy   = "Terraform-bootstrap"
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  repo_sub   = "repo:${var.github_org_repo}"
}

# --- Remote state backend for the main stack ---
resource "aws_s3_bucket" "tfstate" {
  bucket = "starshipos-tfstate-${var.environment}"
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tflock" {
  name         = "starshipos-tflock-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  attribute {
    name = "LockID"
    type = "S"
  }
}

# --- GitHub OIDC identity provider ---
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# --- Terraform role (assumed by infra.yml) ---
# Scoped to this repo. Broad AWS permissions because it manages VPC/RDS/IAM/etc;
# the real control is the assume-role condition below — only GitHub Actions in
# this exact repo can assume it.
data "aws_iam_policy_document" "terraform_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = var.terraform_allowed_subs
    }
  }
}

resource "aws_iam_role" "terraform" {
  name               = "starshipos-terraform-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.terraform_assume.json
}

resource "aws_iam_role_policy_attachment" "terraform_admin" {
  role       = aws_iam_role.terraform.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

# --- Deploy role (assumed by api-deploy.yml) ---
# Tightly scoped: push images to ECR, roll the ECS service, pass the task roles.
data "aws_iam_policy_document" "deploy_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = var.deploy_allowed_subs
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "starshipos-deploy-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.deploy_assume.json
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "EcrAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    sid    = "EcrPush"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = ["arn:aws:ecr:${var.aws_region}:${local.account_id}:repository/starshipos-*"]
  }
  statement {
    sid    = "EcsDeploy"
    effect = "Allow"
    actions = [
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
      "ecs:UpdateService",
    ]
    resources = ["*"]
  }
  statement {
    sid       = "PassTaskRoles"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = ["arn:aws:iam::${local.account_id}:role/starshipos-*-api-*"]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "starshipos-deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}

output "state_bucket" { value = aws_s3_bucket.tfstate.id }
output "lock_table" { value = aws_dynamodb_table.tflock.name }
output "terraform_role_arn" { value = aws_iam_role.terraform.arn }
output "deploy_role_arn" { value = aws_iam_role.deploy.arn }
output "github_secrets_to_set" {
  value = {
    AWS_TERRAFORM_ROLE_ARN = aws_iam_role.terraform.arn
    AWS_DEPLOY_ROLE_ARN    = aws_iam_role.deploy.arn
  }
}
