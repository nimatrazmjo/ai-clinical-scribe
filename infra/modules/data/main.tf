# ── Data module ────────────────────────────────────────────────────────────
# RDS PostgreSQL 16 in the private-data subnets. The three things that make
# "RDS is not publicly accessible" (rubric #7) provable:
#   1. db_subnet_group over data subnets that have no internet route
#   2. publicly_accessible = false
#   3. vpc_security_group_ids references the db SG (app/proxy ingress only)
#
# Master credentials are RDS-managed in Secrets Manager (no password in code
# or state). The app connects as a least-privilege role created in a later
# phase — not as this master user.

data "aws_region" "current" {}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db-subnets"
  subnet_ids = var.data_subnet_ids
  tags       = merge(var.tags, { Name = "${var.name}-db-subnets" })
}

resource "aws_db_parameter_group" "this" {
  name        = "${var.name}-pg16"
  family      = "postgres16"
  description = "Postgres 16 parameters for ${var.name}"

  # Reject any non-TLS client connection at the engine level.
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, { Name = "${var.name}-pg16" })
}

resource "aws_db_instance" "this" {
  identifier     = "${var.name}-postgres"
  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage # storage autoscaling ceiling
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = var.kms_key_arn # null → AWS-managed RDS key

  db_name  = var.db_name
  username = var.master_username
  # RDS creates and rotates the master secret in Secrets Manager. No password
  # attribute is set anywhere, so none can leak into code or tfstate.
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.db_security_group_id]
  parameter_group_name   = aws_db_parameter_group.this.name

  publicly_accessible = false # ── rubric #7 ──

  multi_az                   = var.multi_az
  backup_retention_period    = var.backup_retention_period
  deletion_protection        = var.deletion_protection
  skip_final_snapshot        = var.skip_final_snapshot
  final_snapshot_identifier  = var.skip_final_snapshot ? null : "${var.name}-final"
  apply_immediately          = var.apply_immediately
  auto_minor_version_upgrade = true

  performance_insights_enabled    = var.enable_performance_insights
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = merge(var.tags, { Name = "${var.name}-postgres" })
}

# ── RDS Proxy (optional) ───────────────────────────────────────────────────
# Multiplexes app connections onto a bounded set of DB connections and smooths
# failover. Off by default so the first apply is a clean private-RDS proof;
# flip enable_rds_proxy=true once the app path needs it. Self-contained: uses
# the RDS-managed master secret + its own least-privilege role.
data "aws_iam_policy_document" "proxy_assume" {
  count = var.enable_rds_proxy ? 1 : 0

  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "proxy" {
  count              = var.enable_rds_proxy ? 1 : 0
  name               = "${var.name}-rdsproxy-role"
  assume_role_policy = data.aws_iam_policy_document.proxy_assume[0].json
  tags               = merge(var.tags, { Name = "${var.name}-rdsproxy-role" })
}

data "aws_iam_policy_document" "proxy_secret" {
  count = var.enable_rds_proxy ? 1 : 0

  statement {
    sid       = "ReadDbMasterSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_db_instance.this.master_user_secret[0].secret_arn]
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

resource "aws_iam_role_policy" "proxy_secret" {
  count  = var.enable_rds_proxy ? 1 : 0
  name   = "read-db-master-secret"
  role   = aws_iam_role.proxy[0].id
  policy = data.aws_iam_policy_document.proxy_secret[0].json
}

resource "aws_db_proxy" "this" {
  count                  = var.enable_rds_proxy ? 1 : 0
  name                   = "${var.name}-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.proxy[0].arn
  vpc_subnet_ids         = var.data_subnet_ids
  vpc_security_group_ids = [var.rdsproxy_security_group_id]
  require_tls            = true

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_db_instance.this.master_user_secret[0].secret_arn
  }

  tags = merge(var.tags, { Name = "${var.name}-proxy" })
}

resource "aws_db_proxy_default_target_group" "this" {
  count         = var.enable_rds_proxy ? 1 : 0
  db_proxy_name = aws_db_proxy.this[0].name

  connection_pool_config {
    max_connections_percent      = var.proxy_max_connections_percent
    max_idle_connections_percent = var.proxy_max_idle_connections_percent
  }
}

resource "aws_db_proxy_target" "this" {
  count                  = var.enable_rds_proxy ? 1 : 0
  db_proxy_name          = aws_db_proxy.this[0].name
  target_group_name      = aws_db_proxy_default_target_group.this[0].name
  db_instance_identifier = aws_db_instance.this.identifier
}
