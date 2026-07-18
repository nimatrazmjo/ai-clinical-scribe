output "alb_sg_id" {
  value       = aws_security_group.alb.id
  description = "ALB security group id (edge module attaches the ALB here)."
}

output "app_sg_id" {
  value       = aws_security_group.app.id
  description = "App-tier security group id (compute module attaches ECS/EC2 here)."
}

output "db_sg_id" {
  value       = aws_security_group.db.id
  description = "RDS security group id."
}

output "rdsproxy_sg_id" {
  value       = aws_security_group.rdsproxy.id
  description = "RDS Proxy security group id."
}
