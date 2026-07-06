environment     = "dev"
aws_region      = "eu-west-2"
github_org_repo = "DevelopmentCrew/starshipos-platform"

# In the dev account, allow the deploy role from the 'dev' GitHub environment.
deploy_allowed_subs = [
  "repo:DevelopmentCrew/starshipos-platform:environment:dev",
]
