output "secret_arns" {
  value       = { for k, s in aws_secretsmanager_secret.this : k => s.arn }
  description = "Map of logical name -> secret ARN (feed to the execution role and the task-def GH vars)."
}

output "secret_arn_list" {
  value       = [for s in aws_secretsmanager_secret.this : s.arn]
  description = "Flat list of secret ARNs (for scoping the execution-role policy)."
}
