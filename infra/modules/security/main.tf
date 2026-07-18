# ── Security module ────────────────────────────────────────────────────────
# Four tiers, each rule a discrete resource with a description (so `sg-audit`
# and a live walkthrough read cleanly). Convention (infra/CLAUDE.md):
#   • every rule carries a one-line reason
#   • no 0.0.0.0/0 ingress anywhere except 443/80 on the ALB
#   • tiers reference each other by SG id, never by CIDR
#
# Traffic path:  internet ─443/80─► alb ─80─► app ─5432─► (rdsproxy) ─5432─► db

resource "aws_security_group" "alb" {
  name        = "${var.name}-alb-sg"
  description = "Public ALB - HTTPS in, forward to the app tier"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-alb-sg" })
}

resource "aws_security_group" "app" {
  name        = "${var.name}-app-sg"
  description = "App tier (ECS/EC2 + nginx) - reachable only via the ALB"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-app-sg" })
}

resource "aws_security_group" "db" {
  name        = "${var.name}-db-sg"
  description = "RDS Postgres - VPC-only, app/proxy ingress only, no egress"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-db-sg" })
}

resource "aws_security_group" "rdsproxy" {
  name        = "${var.name}-rdsproxy-sg"
  description = "RDS Proxy - sits between the app tier and RDS"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-rdsproxy-sg" })
}

# ── ALB rules ──────────────────────────────────────────────────────────────
resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  for_each          = toset(var.alb_ingress_cidrs)
  security_group_id = aws_security_group.alb.id
  description       = "Public HTTPS (the only wildcard ingress we allow)"
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

resource "aws_vpc_security_group_ingress_rule" "alb_http_redirect" {
  for_each          = toset(var.alb_ingress_cidrs)
  security_group_id = aws_security_group.alb.id
  description       = "HTTP - used only to 301-redirect to HTTPS"
  cidr_ipv4         = each.value
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id            = aws_security_group.alb.id
  description                  = "Forward to app-tier nginx on 80"
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
}

# ── App rules ──────────────────────────────────────────────────────────────
resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id            = aws_security_group.app.id
  description                  = "nginx reachable ONLY from the ALB (rubric #6)"
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 80
  to_port                      = 80
}

resource "aws_vpc_security_group_egress_rule" "app_to_db" {
  security_group_id            = aws_security_group.app.id
  description                  = "Postgres direct to RDS (pre-proxy / fallback)"
  referenced_security_group_id = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "app_to_rdsproxy" {
  security_group_id            = aws_security_group.app.id
  description                  = "Postgres via RDS Proxy (preferred path)"
  referenced_security_group_id = aws_security_group.rdsproxy.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "app_https_egress" {
  security_group_id = aws_security_group.app.id
  description       = "HTTPS egress via NAT (ECR pulls, Secrets Manager, Anthropic API)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}

# ── DB rules ── ingress only, no egress (strict) ───────────────────────────
resource "aws_vpc_security_group_ingress_rule" "db_from_app" {
  security_group_id            = aws_security_group.db.id
  description                  = "Postgres from the app tier only"
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_ingress_rule" "db_from_rdsproxy" {
  security_group_id            = aws_security_group.db.id
  description                  = "Postgres from RDS Proxy"
  referenced_security_group_id = aws_security_group.rdsproxy.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

# ── RDS Proxy rules ────────────────────────────────────────────────────────
resource "aws_vpc_security_group_ingress_rule" "rdsproxy_from_app" {
  security_group_id            = aws_security_group.rdsproxy.id
  description                  = "App connects to the proxy"
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}

resource "aws_vpc_security_group_egress_rule" "rdsproxy_to_db" {
  security_group_id            = aws_security_group.rdsproxy.id
  description                  = "Proxy connects to RDS"
  referenced_security_group_id = aws_security_group.db.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}
