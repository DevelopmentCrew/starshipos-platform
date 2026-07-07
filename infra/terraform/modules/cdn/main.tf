terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws.us_east_1]
    }
  }
}

variable "name" { type = string }
variable "create_dns_and_tls" { type = bool }
variable "frontend_domain" { type = string }
variable "root_domain" { type = string }
variable "frontend_bucket_regional_dn" { type = string }
variable "frontend_bucket_arn" { type = string }
variable "frontend_bucket_id" { type = string }
variable "api_alb_dns_name" { type = string }

# --- Custom-domain path (prod): Route53 zone + ACM cert ---
data "aws_route53_zone" "root" {
  count = var.create_dns_and_tls ? 1 : 0
  name  = var.root_domain
}

resource "aws_acm_certificate" "frontend" {
  count             = var.create_dns_and_tls ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.frontend_domain
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
}

resource "aws_route53_record" "cert_validation" {
  for_each = var.create_dns_and_tls ? {
    for dvo in aws_acm_certificate.frontend[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  } : {}
  zone_id = data.aws_route53_zone.root[0].zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "frontend" {
  count                   = var.create_dns_and_tls ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.frontend[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# --- CloudFront (both paths) ---
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.name}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = var.create_dns_and_tls ? [var.frontend_domain] : []
  comment             = "${var.name} frontend"

  origin {
    domain_name              = var.frontend_bucket_regional_dn
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # The API load balancer, so /api/* is served over HTTPS on the same domain.
  origin {
    domain_name = var.api_alb_dns_name
    origin_id   = "api-alb"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
  }

  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api-alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingDisabled
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # Managed-AllViewerExceptHostHeader
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  # Custom cert when we have a domain; CloudFront's default *.cloudfront.net cert otherwise.
  dynamic "viewer_certificate" {
    for_each = var.create_dns_and_tls ? [1] : []
    content {
      acm_certificate_arn      = aws_acm_certificate_validation.frontend[0].certificate_arn
      ssl_support_method       = "sni-only"
      minimum_protocol_version = "TLSv1.2_2021"
    }
  }
  dynamic "viewer_certificate" {
    for_each = var.create_dns_and_tls ? [] : [1]
    content {
      cloudfront_default_certificate = true
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = var.frontend_bucket_id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontRead"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${var.frontend_bucket_arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn }
      }
    }]
  })
}

resource "aws_route53_record" "frontend_alias" {
  count   = var.create_dns_and_tls ? 1 : 0
  zone_id = data.aws_route53_zone.root[0].zone_id
  name    = var.frontend_domain
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

output "cloudfront_domain_name" { value = aws_cloudfront_distribution.frontend.domain_name }
output "cloudfront_distribution_id" { value = aws_cloudfront_distribution.frontend.id }
