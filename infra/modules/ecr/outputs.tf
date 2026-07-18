output "repository_urls" {
  value       = { for k, r in aws_ecr_repository.this : k => r.repository_url }
  description = "Map of repo key -> registry URL (push target for CI)."
}

output "repository_arns" {
  value       = { for k, r in aws_ecr_repository.this : k => r.arn }
  description = "Map of repo key -> ARN (used to scope the CI push policy)."
}

output "repository_names" {
  value       = { for k, r in aws_ecr_repository.this : k => r.name }
  description = "Map of repo key -> repository name."
}
