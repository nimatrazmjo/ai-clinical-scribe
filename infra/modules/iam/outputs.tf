output "instance_profile_arn" {
  value       = aws_iam_instance_profile.instance.arn
  description = "EC2 instance profile ARN for the ECS launch template."
}

output "instance_profile_name" {
  value       = aws_iam_instance_profile.instance.name
  description = "EC2 instance profile name."
}

output "execution_role_arn" {
  value       = aws_iam_role.execution.arn
  description = "ECS task execution role ARN (GH var EXECUTION_ROLE_ARN)."
}

output "task_role_arn" {
  value       = aws_iam_role.task.arn
  description = "ECS task role ARN (GH var TASK_ROLE_ARN)."
}
