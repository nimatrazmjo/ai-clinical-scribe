output "db_instance_identifier" {
  value       = aws_db_instance.this.identifier
  description = "RDS instance identifier."
}

output "db_endpoint" {
  value       = aws_db_instance.this.endpoint
  description = "RDS connection endpoint (host:port)."
}

output "db_address" {
  value       = aws_db_instance.this.address
  description = "RDS hostname."
}

output "db_port" {
  value       = aws_db_instance.this.port
  description = "RDS port."
}

output "db_name" {
  value       = aws_db_instance.this.db_name
  description = "Initial database name."
}

output "master_user_secret_arn" {
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
  description = "Secrets Manager ARN of the RDS-managed master credentials."
}

output "db_subnet_group_name" {
  value       = aws_db_subnet_group.this.name
  description = "DB subnet group name."
}

output "rds_proxy_endpoint" {
  value       = var.enable_rds_proxy ? aws_db_proxy.this[0].endpoint : null
  description = "RDS Proxy endpoint (null when the proxy is disabled)."
}
