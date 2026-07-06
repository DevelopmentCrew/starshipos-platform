variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "environment" {
  description = "dev | prod (this account's role in the world)."
  type        = string
}

variable "github_org_repo" {
  description = "The GitHub org/repo that owns the platform code."
  type        = string
  default     = "DevelopmentCrew/starshipos-platform"
}

# Which GitHub OIDC 'sub' values may assume the Terraform role.
# Terraform runs on PRs (plan) and on main (apply), so both are allowed.
variable "terraform_allowed_subs" {
  description = "Allowed OIDC subs for the Terraform role."
  type        = list(string)
  default     = [
    "repo:DevelopmentCrew/starshipos-platform:*",
  ]
}

# The deploy role should only be assumable from the protected 'prod' (or 'dev')
# GitHub environment, so a random PR can't push an image or roll the service.
variable "deploy_allowed_subs" {
  description = "Allowed OIDC subs for the deploy role."
  type        = list(string)
  default     = [
    "repo:DevelopmentCrew/starshipos-platform:environment:prod",
  ]
}
