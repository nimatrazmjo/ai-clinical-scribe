output "alb_arn" {
  value       = aws_lb.this.arn
  description = "ALB ARN."
}

output "alb_dns_name" {
  value       = aws_lb.this.dns_name
  description = "Public DNS name of the ALB (point your Route 53 record here)."
}

output "alb_zone_id" {
  value       = aws_lb.this.zone_id
  description = "ALB hosted zone id (for a Route 53 alias record)."
}

output "target_group_arn" {
  value       = aws_lb_target_group.this.arn
  description = "Target group ARN the ECS service registers into."
}

output "alb_arn_suffix" {
  value       = aws_lb.this.arn_suffix
  description = "ALB ARN suffix for CloudWatch dimensions."
}

output "target_group_arn_suffix" {
  value       = aws_lb_target_group.this.arn_suffix
  description = "Target group ARN suffix for CloudWatch dimensions."
}
