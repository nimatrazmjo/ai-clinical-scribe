# ── GitHub OIDC module ─────────────────────────────────────────────────────
# Lets GitHub Actions assume an AWS role via short-lived OIDC tokens — no
# long-lived access keys stored in GitHub. The role's trust policy is pinned
# to this repository and to the branches/refs allowed to deploy, so a fork or
# a different branch cannot assume it.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.existing_oidc_provider_arn

  github_owner = split("/", var.github_repo)[0]
  github_name  = split("/", var.github_repo)[1]

  # GitHub Actions OIDC tokens identify the repo in the `sub` claim two ways:
  #   - legacy:    repo:<owner>/<repo>
  #   - immutable: repo:<owner>@<owner_id>/<repo>@<repo_id>
  # Repos created on/after 2026-07-15 default to the immutable format (GitHub
  # changelog, "Immutable subject claims for GitHub Actions OIDC tokens").
  # Older repos keep the legacy format unless they opt in. Matching both
  # patterns means this trust policy works either way and survives GitHub
  # migrating the default again later.
  github_repo_patterns = [
    var.github_repo,
    "${local.github_owner}@*/${local.github_name}@*",
  ]
}

# One GitHub OIDC provider per AWS account. If your account already has it,
# set create_oidc_provider=false and pass existing_oidc_provider_arn.
resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_oidc_provider ? 1 : 0

  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = var.thumbprint_list

  tags = merge(var.tags, { Name = "${var.name}-github-oidc" })
}

data "aws_iam_policy_document" "trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [local.oidc_provider_arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Only this repo (legacy or immutable subject form - see locals above),
    # only the allowed refs (default: main) or environments (default:
    # production). GitHub changes the sub claim format when a job targets
    # `environment:` - it becomes repo:<repo-form>:environment:<name> instead
    # of repo:<repo-form>:ref:<ref>, so both must be allowed or any job with
    # `environment:` set (like the deploy job) gets rejected.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = concat(
        flatten([for p in local.github_repo_patterns : [for r in var.allowed_refs : "repo:${p}:ref:${r}"]]),
        flatten([for p in local.github_repo_patterns : [for e in var.allowed_environments : "repo:${p}:environment:${e}"]])
      )
    }
  }
}

resource "aws_iam_role" "deploy" {
  name               = "${var.name}-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.trust.json
  description        = "Assumed by GitHub Actions (OIDC) to build/push images and deploy to ECS."
  tags               = merge(var.tags, { Name = "${var.name}-github-actions-deploy" })
}

data "aws_iam_policy_document" "perms" {
  # ECR auth token is account-wide by API design.
  statement {
    sid       = "EcrAuthToken"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # Push/pull scoped to exactly this project's repositories.
  statement {
    sid = "EcrPushPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
      "ecr:DescribeImages",
      "ecr:ListImages"
    ]
    resources = var.ecr_repository_arns
  }

  # RegisterTaskDefinition has no resource-level support (must be "*").
  # The mutating service calls are scoped by condition to this cluster below.
  statement {
    sid = "EcsTaskDefinition"
    actions = [
      "ecs:RegisterTaskDefinition",
      "ecs:DeregisterTaskDefinition",
      "ecs:DescribeTaskDefinition"
    ]
    resources = ["*"]
  }

  statement {
    sid = "EcsDeploy"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
      "ecs:DescribeTasks",
      "ecs:ListTasks",
      "ecs:RunTask"
    ]
    # Scope to the target cluster once known (Phase 6). "*" until then.
    resources = var.ecs_resource_arns
  }

  # Needed so RegisterTaskDefinition can reference the task/execution roles.
  statement {
    sid       = "PassTaskRoles"
    actions   = ["iam:PassRole"]
    resources = var.passable_role_arns

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.perms.json
}
