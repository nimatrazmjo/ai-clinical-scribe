output "cluster_name" {
  value       = aws_ecs_cluster.this.name
  description = "ECS cluster name (GH var ECS_CLUSTER)."
}

output "cluster_arn" {
  value       = aws_ecs_cluster.this.arn
  description = "ECS cluster ARN."
}

output "service_name" {
  value       = aws_ecs_service.this.name
  description = "ECS service name (GH var ECS_SERVICE)."
}

output "service_arn" {
  value       = aws_ecs_service.this.id
  description = "ECS service ARN (use to scope the deploy role's ECS actions)."
}

output "task_family" {
  value       = aws_ecs_task_definition.placeholder.family
  description = "Task-definition family (GH var TASK_FAMILY)."
}

output "capacity_provider_name" {
  value       = aws_ecs_capacity_provider.this.name
  description = "ECS capacity provider name."
}

output "log_group_names" {
  value       = [aws_cloudwatch_log_group.web.name, aws_cloudwatch_log_group.api.name]
  description = "CloudWatch log groups for the web and api containers."
}
