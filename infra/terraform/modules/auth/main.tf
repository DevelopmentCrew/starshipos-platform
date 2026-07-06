variable "name" { type = string }
variable "create_dns_and_tls" { type = bool }
variable "frontend_domain" { type = string }
variable "ses_from_address" { type = string }
variable "root_domain" { type = string }

# --- SES branded sender (custom-domain path only) ---
resource "aws_ses_domain_identity" "this" {
  count  = var.create_dns_and_tls ? 1 : 0
  domain = var.root_domain
}

resource "aws_ses_domain_dkim" "this" {
  count  = var.create_dns_and_tls ? 1 : 0
  domain = aws_ses_domain_identity.this[0].domain
}

data "aws_route53_zone" "root" {
  count = var.create_dns_and_tls ? 1 : 0
  name  = var.root_domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = var.create_dns_and_tls ? 3 : 0
  zone_id = data.aws_route53_zone.root[0].zone_id
  name    = "${aws_ses_domain_dkim.this[0].dkim_tokens[count.index]}._domainkey.${var.root_domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.this[0].dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# --- Cognito user pool ---
resource "aws_cognito_user_pool" "this" {
  name                     = "${var.name}-users"
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Branded SES sender when we have a domain; Cognito's built-in sender for dev.
  dynamic "email_configuration" {
    for_each = var.create_dns_and_tls ? [1] : []
    content {
      email_sending_account = "DEVELOPER"
      from_email_address    = var.ses_from_address
      source_arn            = aws_ses_domain_identity.this[0].arn
    }
  }
  dynamic "email_configuration" {
    for_each = var.create_dns_and_tls ? [] : [1]
    content {
      email_sending_account = "COGNITO_DEFAULT"
    }
  }

  schema {
    name                = "employee_id"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 0
      max_length = 64
    }
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name}-web"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = ["https://${var.frontend_domain}/auth/callback", "http://localhost:5173/auth/callback"]
  logout_urls   = ["https://${var.frontend_domain}/auth/logout", "http://localhost:5173/auth/logout"]

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

output "user_pool_id" { value = aws_cognito_user_pool.this.id }
output "user_pool_arn" { value = aws_cognito_user_pool.this.arn }
output "app_client_id" { value = aws_cognito_user_pool_client.web.id }
output "ses_domain_identity_arn" { value = var.create_dns_and_tls ? aws_ses_domain_identity.this[0].arn : null }
