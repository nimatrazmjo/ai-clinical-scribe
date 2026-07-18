output "certificate_arn" {
  # From the validation resource so downstream (the ALB listener) waits for ISSUED.
  value       = aws_acm_certificate_validation.this.certificate_arn
  description = "Validated ACM certificate ARN."
}

output "zone_id" {
  value       = local.zone_id
  description = "Hosted zone id (used by the root alias record)."
}

output "fqdn" {
  value       = var.domain_name
  description = "The app hostname."
}

output "name_servers" {
  value       = var.create_hosted_zone ? aws_route53_zone.this[0].name_servers : null
  description = "If the zone was created, delegate these at your registrar."
}
