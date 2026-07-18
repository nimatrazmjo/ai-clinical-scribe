# Network
output "vpc_id" {
  value = module.network.vpc_id
}

output "public_subnet_ids" {
  value = module.network.public_subnet_ids
}

output "app_subnet_ids" {
  value = module.network.app_subnet_ids
}

output "data_subnet_ids" {
  value = module.network.data_subnet_ids
}

# Security
output "alb_sg_id" {
  value = module.security.alb_sg_id
}

output "app_sg_id" {
  value = module.security.app_sg_id
}

output "db_sg_id" {
  value = module.security.db_sg_id
}

output "rdsproxy_sg_id" {
  value = module.security.rdsproxy_sg_id
}

# Data
output "db_endpoint" {
  value = module.data.db_endpoint
}

output "db_master_secret_arn" {
  value       = module.data.master_user_secret_arn
  description = "Feed this ARN to the app/proxy in later phases — the value never leaves Secrets Manager."
}

output "rds_proxy_endpoint" {
  value = module.data.rds_proxy_endpoint
}

# CI/CD — feed these into GitHub Actions repo variables (see IMPLEMENTATION_PHASES.md)
output "ecr_repository_urls" {
  value       = module.ecr.repository_urls
  description = "Push targets. NAME_PREFIX var = the part before /api and /web."
}

output "github_actions_role_arn" {
  value       = module.github_oidc.deploy_role_arn
  description = "GitHub Actions repo variable AWS_DEPLOY_ROLE_ARN."
}

output "aws_account_id" {
  value       = module.github_oidc.account_id
  description = "GitHub Actions repo variable AWS_ACCOUNT_ID."
}

# Edge / Compute — the remaining GitHub Actions repo variables
output "alb_dns_name" {
  value       = module.edge.alb_dns_name
  description = "Public URL of the app (http://<this> until an ACM cert is set)."
}

output "ecs_cluster_name" {
  value       = module.compute.cluster_name
  description = "GH var ECS_CLUSTER."
}

output "ecs_service_name" {
  value       = module.compute.service_name
  description = "GH var ECS_SERVICE."
}

output "task_family" {
  value       = module.compute.task_family
  description = "GH var TASK_FAMILY."
}

output "execution_role_arn" {
  value       = module.iam.execution_role_arn
  description = "GH var EXECUTION_ROLE_ARN."
}

output "task_role_arn" {
  value       = module.iam.task_role_arn
  description = "GH var TASK_ROLE_ARN."
}

output "app_secret_arns" {
  value       = module.secrets.secret_arns
  description = "GH vars DATABASE_URL_ARN / ANTHROPIC_API_KEY_ARN / JWT_SECRET_ARN."
}

# DNS / TLS
output "app_url" {
  value       = local.enable_dns ? "https://${var.domain_name}" : "http://${module.edge.alb_dns_name}"
  description = "Where the app is reachable."
}

output "certificate_arn" {
  value       = one(module.dns[*].certificate_arn)
  description = "Validated ACM cert ARN (null when running HTTP-only)."
}

output "route53_name_servers" {
  value       = one(module.dns[*].name_servers)
  description = "If a hosted zone was created, delegate these NS records at your registrar."
}

# Phase 7
output "waf_web_acl_arn" {
  value       = one(module.waf[*].web_acl_arn)
  description = "WAF web ACL ARN (null when disabled)."
}

output "alarms_sns_topic_arn" {
  value       = one(module.observability[*].sns_topic_arn)
  description = "Alarm topic ARN — subscribe Slack/PagerDuty here (null when disabled)."
}
