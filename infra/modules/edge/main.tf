# ── Edge module (ALB) ──────────────────────────────────────────────────────
# Public ALB → target group → the ECS task's nginx (web) container on 80.
# Target type is "ip" because the task uses awsvpc networking (each task gets
# its own ENI). The app process never binds 80/443 — only nginx does, and only
# inside the task (rubric #6).
#
# TLS: pass certificate_arn to enable HTTPS:443 + a 80→443 redirect (rubric #1).
# Without it the ALB serves HTTP:80 so the pipeline is provable end-to-end now;
# add the cert (Phase 5, needs a domain) to finish requirement #1.

# tls_enabled is driven by a static flag (not the cert ARN) so listener `count`
# is known at plan time even when the ARN is created in the same apply.
locals {
  tls_enabled = var.enable_https
}

resource "aws_lb" "this" {
  name               = "${var.name}-alb"
  load_balancer_type = "application"
  internal           = false
  subnets            = var.public_subnet_ids
  security_groups    = [var.alb_sg_id]
  idle_timeout       = var.idle_timeout # 300s so SSE streams aren't cut

  tags = merge(var.tags, { Name = "${var.name}-alb" })
}

resource "aws_lb_target_group" "this" {
  name        = "${var.name}-tg"
  port        = var.target_port
  protocol    = "HTTP"
  target_type = "ip" # awsvpc tasks register by ENI IP
  vpc_id      = var.vpc_id

  deregistration_delay = 30

  health_check {
    path                = var.health_check_path
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, { Name = "${var.name}-tg" })
}

# ── HTTP:80 — forwards to the TG when there's no cert, else redirects to 443 ─
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = local.tls_enabled ? [1] : []
    content {
      type = "redirect"
      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  dynamic "default_action" {
    for_each = local.tls_enabled ? [] : [1]
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.this.arn
    }
  }
}

# ── HTTPS:443 — only when a cert is supplied ───────────────────────────────
resource "aws_lb_listener" "https" {
  count             = local.tls_enabled ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = var.ssl_policy
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}
