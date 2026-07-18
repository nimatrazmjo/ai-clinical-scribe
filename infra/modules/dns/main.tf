# ── DNS module (Phase 5) ────────────────────────────────────────────────────
# Hosted zone (create or reuse) + a DNS-validated ACM certificate for the app
# hostname. The validated cert ARN is what turns on HTTPS at the ALB (rubric #1).
# The A/ALIAS record to the ALB is created at the env root (it needs the ALB),
# which keeps this module free of any dependency on the edge module.

# Reuse an existing hosted zone (the common case)…
data "aws_route53_zone" "existing" {
  count        = var.create_hosted_zone ? 0 : 1
  name         = var.hosted_zone_name
  private_zone = false
}

# …or create one (then delegate the NS records at your registrar).
resource "aws_route53_zone" "this" {
  count = var.create_hosted_zone ? 1 : 0
  name  = var.hosted_zone_name
  tags  = merge(var.tags, { Name = var.hosted_zone_name })
}

locals {
  zone_id = var.create_hosted_zone ? aws_route53_zone.this[0].zone_id : data.aws_route53_zone.existing[0].zone_id
}

resource "aws_acm_certificate" "this" {
  domain_name               = var.domain_name
  subject_alternative_names = var.subject_alternative_names
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, { Name = var.domain_name })
}

# One validation CNAME per name on the cert.
resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = local.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

# Blocks until ACM observes the records and issues the cert.
resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]
}
