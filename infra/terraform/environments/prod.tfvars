environment          = "prod"
aws_region           = "eu-west-2"
vpc_cidr             = "10.50.0.0/16"
db_instance_class    = "db.r6g.large"
db_allocated_storage = 100
db_multi_az          = true
api_desired_count    = 2

frontend_domain  = "os.starshipgroup.co.uk"
api_domain       = "api.starshipgroup.co.uk"
root_domain      = "starshipgroup.co.uk"
ses_from_address = "no-reply@starshipgroup.co.uk"
