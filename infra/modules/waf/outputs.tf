output "web_acl_arn" {
  value       = aws_wafv2_web_acl.this.arn
  description = "ARN of the WAFv2 web ACL."
}
