environment     = "prod"
aws_region      = "eu-west-2"
github_org_repo = "DevelopmentCrew/starshipos-platform"

# In the prod account, only the protected 'prod' GitHub environment may deploy.
deploy_allowed_subs = [
  "repo:DevelopmentCrew/starshipos-platform:environment:prod",
]
