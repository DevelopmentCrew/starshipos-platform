output "vpc_id" {
  value = module.network.vpc_id
}

output "db_endpoint" {
  description = "RDS Postgres endpoint (host:port)."
  value       = module.database.db_endpoint
}

output "db_secret_arn" {
  description = "Secrets Manager ARN holding the DB credentials JSON."
  value       = module.database.db_secret_arn
}

output "frontend_bucket" {
  value = module.storage.frontend_bucket_id
}

output "frontend_cloudfront_domain" {
  value = module.cdn.cloudfront_domain_name
}

output "cognito_user_pool_id" {
  value = module.auth.user_pool_id
}

output "cognito_app_client_id" {
  value = module.auth.app_client_id
}

output "api_ecr_repository_url" {
  value = module.api.ecr_repository_url
}

output "api_alb_dns_name" {
  value = module.api.alb_dns_name
}
