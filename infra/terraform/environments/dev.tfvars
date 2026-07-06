environment          = "dev"
aws_region           = "eu-west-2"

# Dev uses AWS default domains (no Route53/ACM). The company domain is hosted at
# Fasthosts/LiveDNS which can't delegate a subdomain to Route53, and dev doesn't
# need custom URLs anyway. Prod attaches the real domain (create_dns_and_tls = true).
create_dns_and_tls = false
vpc_cidr             = "10.40.0.0/16"
db_instance_class    = "db.t4g.medium"
db_allocated_storage = 50
db_multi_az          = false
api_desired_count    = 1

# Dev uses a delegated subdomain zone (dev.starshipgroup.co.uk) so the live
# apex domain (production app + email) is never touched. Only the dev. branch
# is delegated to Route53.
frontend_domain  = "os.dev.starshipgroup.co.uk"
api_domain       = "api.dev.starshipgroup.co.uk"
root_domain      = "dev.starshipgroup.co.uk"
ses_from_address = "no-reply@dev.starshipgroup.co.uk"
