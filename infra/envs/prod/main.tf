# ── prod environment ───────────────────────────────────────────────────────
# Wires the three tiers of this delivery. Dependencies flow network → security
# → data via module outputs, so a single `terraform apply` builds them in the
# right order. (Later phases add secrets, iam, edge, dns, compute.)

module "network" {
  source = "../../modules/network"

  name                = var.name
  vpc_cidr            = var.vpc_cidr
  az_count            = var.az_count
  public_subnet_cidrs = var.public_subnet_cidrs
  app_subnet_cidrs    = var.app_subnet_cidrs
  data_subnet_cidrs   = var.data_subnet_cidrs
  single_nat_gateway  = var.single_nat_gateway
}

module "security" {
  source = "../../modules/security"

  name   = var.name
  vpc_id = module.network.vpc_id
}

module "data" {
  source = "../../modules/data"

  name                       = var.name
  data_subnet_ids            = module.network.data_subnet_ids
  db_security_group_id       = module.security.db_sg_id
  rdsproxy_security_group_id = module.security.rdsproxy_sg_id

  engine_version              = var.db_engine_version
  instance_class               = var.db_instance_class
  multi_az                     = var.db_multi_az
  deletion_protection          = var.db_deletion_protection
  skip_final_snapshot          = var.db_skip_final_snapshot
  backup_retention_period      = var.db_backup_retention_period
  enable_performance_insights  = var.db_enable_performance_insights
  enable_rds_proxy             = var.enable_rds_proxy
}

# ── CI/CD (applyable now; independent of the Phase 6 ECS service) ───────────
module "ecr" {
  source = "../../modules/ecr"
  name   = var.name
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  name                 = var.name
  github_repo          = var.github_repo
  ecr_repository_arns  = values(module.ecr.repository_arns)
  create_oidc_provider = var.create_github_oidc_provider

  # Scoped now that Phase 6 roles exist (least privilege on PassRole):
  passable_role_arns = [module.iam.execution_role_arn, module.iam.task_role_arn]
  ecs_resource_arns  = ["*"] # RunTask/UpdateService resource ARNs vary; still limited to ECS/ECR actions
}

# ── Phase 4 — app secret containers (values set out of band) ────────────────
module "secrets" {
  source = "../../modules/secrets"
  name   = var.name
}

# ── IAM roles for ECS (instance / execution / task) ─────────────────────────
module "iam" {
  source          = "../../modules/iam"
  name            = var.name
  app_secret_arns = module.secrets.secret_arn_list
}

# ── Edge — ALB. HTTPS switches on automatically when a domain is configured ──
module "edge" {
  source            = "../../modules/edge"
  name              = var.name
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  alb_sg_id         = module.security.alb_sg_id

  enable_https    = local.enable_https
  certificate_arn = local.certificate_arn
}

# ── Phase 6 — ECS-on-EC2 compute ────────────────────────────────────────────
module "compute" {
  source = "../../modules/compute"

  name                  = var.name
  app_subnet_ids        = module.network.app_subnet_ids
  app_security_group_id = module.security.app_sg_id
  target_group_arn      = module.edge.target_group_arn

  instance_profile_arn = module.iam.instance_profile_arn
  execution_role_arn   = module.iam.execution_role_arn
  task_role_arn        = module.iam.task_role_arn

  instance_type              = var.ecs_instance_type
  desired_count              = var.ecs_desired_count
  min_size                   = var.ecs_min_size
  max_size                   = var.ecs_max_size
  enable_service_autoscaling = var.enable_service_autoscaling
}

# ── Phase 5 — DNS + TLS ─────────────────────────────────────────────────────
# All flags below are plan-time-known (they derive from variables), so the ALB
# listener counts are stable even though the cert ARN is created in this apply.
locals {
  enable_dns      = var.domain_name != "" && var.hosted_zone_name != ""
  enable_https    = local.enable_dns || var.certificate_arn != ""
  certificate_arn = local.enable_dns ? one(module.dns[*].certificate_arn) : var.certificate_arn
}

module "dns" {
  count  = local.enable_dns ? 1 : 0
  source = "../../modules/dns"

  name                      = var.name
  domain_name               = var.domain_name
  hosted_zone_name          = var.hosted_zone_name
  create_hosted_zone        = var.create_hosted_zone
  subject_alternative_names = var.subject_alternative_names
}

# App hostname → ALB (alias). Lives at root so neither module depends on the other.
resource "aws_route53_record" "app" {
  count   = local.enable_dns ? 1 : 0
  zone_id = module.dns[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = module.edge.alb_dns_name
    zone_id                = module.edge.alb_zone_id
    evaluate_target_health = true
  }
}

# ── Phase 7 — hardening (each independently toggleable) ─────────────────────
module "waf" {
  count  = var.enable_waf ? 1 : 0
  source = "../../modules/waf"

  name       = var.name
  alb_arn    = module.edge.alb_arn
  rate_limit = var.waf_rate_limit
}

module "observability" {
  count  = var.enable_alarms ? 1 : 0
  source = "../../modules/observability"

  name                    = var.name
  alb_arn_suffix          = module.edge.alb_arn_suffix
  target_group_arn_suffix = module.edge.target_group_arn_suffix
  db_instance_identifier  = module.data.db_instance_identifier
  ecs_cluster_name        = module.compute.cluster_name
  ecs_service_name        = module.compute.service_name
  alarm_email             = var.alarm_email
}

module "vpc_endpoints" {
  count  = var.enable_vpc_endpoints ? 1 : 0
  source = "../../modules/vpc-endpoints"

  name                  = var.name
  vpc_id                = module.network.vpc_id
  region                = var.region
  app_subnet_ids        = module.network.app_subnet_ids
  app_security_group_id = module.security.app_sg_id
  route_table_ids       = module.network.app_route_table_ids
}
