# ── IAM module ─────────────────────────────────────────────────────────────
# Three roles, each least-privilege:
#   instance  → EC2 container instances join ECS, pull ECR, ship logs, SSM
#   execution → ECS agent pulls images, reads app secrets, writes logs
#   task      → the app's own runtime permissions (ECS Exec only, by default)

data "aws_region" "current" {}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ── EC2 instance role ──────────────────────────────────────────────────────
resource "aws_iam_role" "instance" {
  name               = "${var.name}-ecs-instance-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
  tags               = merge(var.tags, { Name = "${var.name}-ecs-instance-role" })
}

resource "aws_iam_role_policy_attachment" "instance_ecs" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "instance_ssm" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "instance" {
  name = "${var.name}-ecs-instance-profile"
  role = aws_iam_role.instance.name
  tags = merge(var.tags, { Name = "${var.name}-ecs-instance-profile" })
}

# ── ECS task execution role ────────────────────────────────────────────────
resource "aws_iam_role" "execution" {
  name               = "${var.name}-ecs-execution-role"
  assume_role_policy = data.aws_iam_policy_document.tasks_assume.json
  tags               = merge(var.tags, { Name = "${var.name}-ecs-execution-role" })
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Read exactly the app secrets (nothing wildcard). Only created when ARNs exist.
data "aws_iam_policy_document" "execution_secrets" {
  count = length(var.app_secret_arns) > 0 ? 1 : 0

  statement {
    sid       = "ReadAppSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = var.app_secret_arns
  }

  statement {
    sid       = "DecryptViaSecretsManager"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["secretsmanager.${data.aws_region.current.name}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  count  = length(var.app_secret_arns) > 0 ? 1 : 0
  name   = "read-app-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets[0].json
}

# ── ECS task role (runtime) ────────────────────────────────────────────────
# ECS Exec (aws ecs execute-command) so you can shell into a task for debugging
# without SSH. Add app-specific runtime permissions here as needed.
data "aws_iam_policy_document" "task_runtime" {
  statement {
    sid = "EcsExec"
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role" "task" {
  name               = "${var.name}-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.tasks_assume.json
  tags               = merge(var.tags, { Name = "${var.name}-ecs-task-role" })
}

resource "aws_iam_role_policy" "task_runtime" {
  name   = "ecs-exec"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_runtime.json
}
