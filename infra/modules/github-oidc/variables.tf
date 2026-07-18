variable "name" {
  type        = string
  description = "Name prefix for the OIDC provider and deploy role."
}

variable "github_repo" {
  type        = string
  description = "GitHub repo in owner/name form (e.g. your-org/ai-clinical-scribe). Pins the role trust policy."
}

variable "allowed_refs" {
  type        = list(string)
  default     = ["refs/heads/main"]
  description = "Git refs allowed to assume the deploy role. Default: only main."
}

variable "allowed_environments" {
  type        = list(string)
  default     = ["production"]
  description = "GitHub Actions environments allowed to assume the deploy role. Needed because jobs with `environment:` set send a different OIDC sub claim (environment:<name> instead of ref:<ref>) - the deploy job in deploy.yml uses environment: production."
}

variable "ecr_repository_arns" {
  type        = list(string)
  description = "ECR repo ARNs the pipeline may push to."
}

variable "create_oidc_provider" {
  type        = bool
  default     = true
  description = "Create the GitHub OIDC provider. Set false if the account already has one."
}

variable "existing_oidc_provider_arn" {
  type        = string
  default     = ""
  description = "ARN of an existing GitHub OIDC provider (used when create_oidc_provider=false)."
}

variable "thumbprint_list" {
  type        = list(string)
  default     = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c58a3a8518e8759bf075b76b750d4f2df264fcd"]
  description = "GitHub Actions OIDC thumbprints. AWS no longer validates these, but the field is required."
}

variable "ecs_resource_arns" {
  type        = list(string)
  default     = ["*"]
  description = "ARNs for the mutating ECS actions. Scope to the cluster/service once Phase 6 exists."
}

variable "passable_role_arns" {
  type        = list(string)
  default     = ["*"]
  description = "Task execution/task role ARNs the pipeline may PassRole. Scope once Phase 6 exists."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto the OIDC provider and role."
}
