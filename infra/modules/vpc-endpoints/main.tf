# ── VPC endpoints module (Phase 7) ──────────────────────────────────────────
# Keeps ECR pulls, Secrets Manager, CloudWatch Logs, and SSM traffic on the AWS
# network instead of egressing through NAT — lower NAT cost, smaller blast
# radius, and it works even if NAT is removed. S3 gateway endpoint is free and
# carries ECR's underlying layer blobs.

# SG for the interface endpoint ENIs: HTTPS from the app tier only.
resource "aws_security_group" "endpoints" {
  name        = "${var.name}-vpce-sg"
  description = "VPC interface endpoints — HTTPS from the app tier"
  vpc_id      = var.vpc_id
  tags        = merge(var.tags, { Name = "${var.name}-vpce-sg" })
}

resource "aws_vpc_security_group_ingress_rule" "https_from_app" {
  security_group_id            = aws_security_group.endpoints.id
  description                  = "HTTPS from the app tier to the endpoints"
  referenced_security_group_id = var.app_security_group_id
  ip_protocol                  = "tcp"
  from_port                    = 443
  to_port                      = 443
}

# Interface endpoints (one ENI per AZ subnet).
resource "aws_vpc_endpoint" "interface" {
  for_each = toset(var.interface_services)

  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.${var.region}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.app_subnet_ids
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true

  tags = merge(var.tags, { Name = "${var.name}-vpce-${each.value}" })
}

# S3 gateway endpoint (free) attached to the route tables that need it.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.route_table_ids

  tags = merge(var.tags, { Name = "${var.name}-vpce-s3" })
}
