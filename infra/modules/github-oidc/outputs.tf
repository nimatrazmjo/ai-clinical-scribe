output "deploy_role_arn" {
  value       = aws_iam_role.deploy.arn
  description = "Set this as the GitHub Actions repo variable AWS_DEPLOY_ROLE_ARN."
}

output "oidc_provider_arn" {
  value       = local.oidc_provider_arn
  description = "ARN of the GitHub OIDC provider in use."
}

output "account_id" {
  value       = data.aws_caller_identity.current.account_id
  description = "AWS account id (handy for the ECR registry variable)."
}
