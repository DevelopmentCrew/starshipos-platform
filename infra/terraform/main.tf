data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "starshipos-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}

module "network" {
  source   = "./modules/network"
  name     = local.name
  vpc_cidr = var.vpc_cidr
  azs      = local.azs
}

module "database" {
  source                = "./modules/database"
  name                  = local.name
  vpc_id                = module.network.vpc_id
  private_subnet_ids    = module.network.private_subnet_ids
  app_security_group_id = module.api.service_security_group_id
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  db_name               = var.db_name
  db_username           = var.db_username
  multi_az              = var.db_multi_az
}

module "storage" {
  source          = "./modules/storage"
  name            = local.name
  frontend_domain = var.frontend_domain
}

module "cdn" {
  source                      = "./modules/cdn"
  name                        = local.name
  create_dns_and_tls          = var.create_dns_and_tls
  frontend_domain             = var.frontend_domain
  root_domain                 = var.root_domain
  frontend_bucket_regional_dn = module.storage.frontend_bucket_regional_domain_name
  frontend_bucket_arn         = module.storage.frontend_bucket_arn
  frontend_bucket_id          = module.storage.frontend_bucket_id
  api_alb_dns_name            = module.api.alb_dns_name

  providers = {
    aws.us_east_1 = aws.us_east_1
  }
}

module "auth" {
  source             = "./modules/auth"
  name               = local.name
  create_dns_and_tls = var.create_dns_and_tls
  frontend_domain    = var.frontend_domain
  ses_from_address   = var.ses_from_address
  root_domain        = var.root_domain
}

module "api" {
  source             = "./modules/api"
  name               = local.name
  create_dns_and_tls = var.create_dns_and_tls
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids
  container_port     = var.api_container_port
  desired_count      = var.api_desired_count
  api_domain         = var.api_domain
  root_domain        = var.root_domain
}
