variable "aws_region" {
  description = "Primary AWS region for the stack."
  type        = string
  default     = "eu-west-2" # London
}

variable "environment" {
  description = "Deployment environment (dev | staging | prod)."
  type        = string
}

variable "create_dns_and_tls" {
  description = "When true, attach custom domains via Route53 + ACM (prod). When false, use AWS default domains (CloudFront *.cloudfront.net, ALB HTTP, Cognito default email) — no DNS needed. Set false for dev when the domain can't delegate to Route53."
  type        = bool
  default     = true
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "az_count" {
  description = "Number of Availability Zones to spread subnets across."
  type        = number
  default     = 2
}

# --- Database ---
variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage" {
  description = "Initial RDS storage in GB (autoscales)."
  type        = number
  default     = 50
}

variable "db_name" {
  description = "Initial Postgres database name."
  type        = string
  default     = "starshipos"
}

variable "db_username" {
  description = "Master DB username. Password is generated and stored in Secrets Manager."
  type        = string
  default     = "starshipos_admin"
}

variable "db_multi_az" {
  description = "Run RDS with a standby in a second AZ (recommended for prod)."
  type        = bool
  default     = false
}

# --- DNS / domains ---
variable "frontend_domain" {
  description = "Public hostname for the app frontend, e.g. os.starshipgroup.co.uk."
  type        = string
}

variable "api_domain" {
  description = "Public hostname for the API, e.g. api.starshipgroup.co.uk."
  type        = string
}

variable "root_domain" {
  description = "The Route53 hosted-zone apex, e.g. starshipgroup.co.uk."
  type        = string
}

# --- Auth / email ---
variable "ses_from_address" {
  description = "Branded From address for invites and account emails, e.g. no-reply@starshipgroup.co.uk."
  type        = string
}

# --- API container ---
variable "api_container_port" {
  description = "Port the API listens on inside the container."
  type        = number
  default     = 3000
}

variable "api_desired_count" {
  description = "Number of API tasks to run."
  type        = number
  default     = 2
}
