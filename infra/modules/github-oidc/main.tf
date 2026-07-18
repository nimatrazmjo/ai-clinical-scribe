# ── GitHub OIDC module ─────────────────────────────────────────────────────
# Lets GitHub Actions assume an AWS role via short-lived OIDC tokens — no
# long-lived access keys stored in GitHub. The role's trust policy is pinned
# to this repository and to the branches/refs allowed to deploy, so a fork or
# a different branch cannot assume it.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  oidc_provider_arn = var.create_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : var.existing_oidc_provider_arn
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

    # Only this repo, only the allowed refs (default: main).
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [for r in var.allowed_refs : "repo:${var.github_repo}:ref:${r}"]
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
