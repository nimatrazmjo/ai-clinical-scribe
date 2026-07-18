# ── Global ─────────────────────────────────────────────────────────────────
variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region."
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Environment name (used in default_tags)."
}

variable "name" {
  type        = string
  default     = "acs-prod"
  description = "Name prefix for all resources."
}

# ── Network ────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "az_count" {
  type    = number
  default = 2
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "app_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "data_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "single_nat_gateway" {
  type        = bool
  default     = true
  description = "One shared NAT (cheap) vs one per AZ (HA)."
}

# ── Data ───────────────────────────────────────────────────────────────────
variable "db_engine_version" {
  type    = string
  default = "16"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.small"
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_deletion_protection" {
  type    = bool
  default = false
}

variable "db_skip_final_snapshot" {
  type    = bool
  default = true
}

variable "enable_rds_proxy" {
  type        = bool
  default     = false
  description = "Provision RDS Proxy. Leave false for the initial private-RDS proof."
}

# ── CI/CD ──────────────────────────────────────────────────────────────────
variable "github_repo" {
  type        = string
  description = "GitHub repo in owner/name form — pins the deploy role's trust policy. e.g. your-org/ai-clinical-scribe"
}

variable "create_github_oidc_provider" {
  type        = bool
  default     = true
  description = "Create the GitHub OIDC provider. Set false if the account already has one."
}

# ── Edge / Compute (Phase 5/6) ─────────────────────────────────────────────
variable "certificate_arn" {
  type        = string
  default     = ""
  description = "ACM cert ARN. Empty = ALB serves HTTP only; set to enable HTTPS:443 + redirect (rubric #1)."
}

variable "ecs_instance_type" {
  type    = string
  default = "t3.small"
}

variable "ecs_desired_count" {
  type    = number
  default = 1
}

variable "ecs_min_size" {
  type    = number
  default = 1
}

variable "ecs_max_size" {
  type    = number
  default = 2
}

variable "enable_service_autoscaling" {
  type    = bool
  default = false
}

# ── DNS / TLS (Phase 5) ────────────────────────────────────────────────────
# Set both domain_name and hosted_zone_name to switch on Route 53 + ACM + HTTPS.
# Leave blank to keep the ALB on HTTP (still fully deployable end-to-end).
variable "domain_name" {
  type        = string
  default     = ""
  description = "App FQDN, e.g. scribe.example.com. Blank = HTTP only."
}

variable "hosted_zone_name" {
  type        = string
  default     = ""
  description = "Route 53 zone that holds the record, e.g. example.com."
}

variable "create_hosted_zone" {
  type        = bool
  default     = false
  description = "Create the hosted zone (then delegate NS at your registrar). false = reuse existing."
}

variable "subject_alternative_names" {
  type        = list(string)
  default     = []
  description = "Extra SANs on the ACM cert."
}

# ── Phase 7 — hardening ────────────────────────────────────────────────────
variable "enable_waf" {
  type    = bool
  default = false
}

variable "waf_rate_limit" {
  type        = number
  default     = 2000
  description = "WAF per-IP request rate limit (per 5 min)."
}

variable "enable_alarms" {
  type    = bool
  default = false
}

variable "alarm_email" {
  type        = string
  default     = ""
  description = "Email subscribed to the CloudWatch alarm SNS topic (optional)."
}

variable "enable_vpc_endpoints" {
  type        = bool
  default     = false
  description = "Create ECR/Secrets/Logs/SSM interface endpoints + S3 gateway (cuts NAT traffic; hourly cost per endpoint)."
}
