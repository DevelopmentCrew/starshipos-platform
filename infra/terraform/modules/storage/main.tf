variable "name" { type = string }
variable "frontend_domain" { type = string }

# --- Frontend static site bucket (served via CloudFront OAC, private) ---
resource "aws_s3_bucket" "frontend" {
  bucket = "${var.name}-frontend"
  tags   = { Name = "${var.name}-frontend" }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration { status = "Enabled" }
}

# --- User uploads bucket (private; served via presigned URLs / API proxy) ---
resource "aws_s3_bucket" "uploads" {
  bucket = "${var.name}-uploads"
  tags   = { Name = "${var.name}-uploads" }
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "aws:kms" }
    bucket_key_enabled = true
  }
}

# CORS so the browser can PUT directly to presigned upload URLs.
resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["https://${var.frontend_domain}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

output "frontend_bucket_id" { value = aws_s3_bucket.frontend.id }
output "frontend_bucket_arn" { value = aws_s3_bucket.frontend.arn }
output "frontend_bucket_regional_domain_name" { value = aws_s3_bucket.frontend.bucket_regional_domain_name }
output "uploads_bucket_id" { value = aws_s3_bucket.uploads.id }
output "uploads_bucket_arn" { value = aws_s3_bucket.uploads.arn }
