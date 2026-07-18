# ── Compute module (ECS-on-EC2) ────────────────────────────────────────────
# EC2 capacity (ASG) joined to an ECS cluster via a capacity provider, running
# the app as an ECS service behind the ALB target group. The task definition
# is a bootstrap PLACEHOLDER — CI (deploy.yml) owns the real revisions, and the
# service ignores task_definition changes so Terraform and CI don't fight.

data "aws_region" "current" {}

# ECS-optimized AMI (Amazon Linux 2023) resolved at plan time.
data "aws_ssm_parameter" "ecs_ami" {
  name = var.ecs_ami_ssm_parameter
}

# ── Log groups (names must match infra/deploy/ecs/task-definition.json) ─────
resource "aws_cloudwatch_log_group" "web" {
  name              = "${var.log_group_prefix}/web"
  retention_in_days = var.log_retention_days
  tags              = merge(var.tags, { Name = "${var.log_group_prefix}/web" })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "${var.log_group_prefix}/api"
  retention_in_days = var.log_retention_days
  tags              = merge(var.tags, { Name = "${var.log_group_prefix}/api" })
}

# ── Cluster ────────────────────────────────────────────────────────────────
resource "aws_ecs_cluster" "this" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, { Name = var.name })
}

# ── EC2 capacity ───────────────────────────────────────────────────────────
locals {
  user_data = base64encode(<<-EOT
    #!/bin/bash
    echo "ECS_CLUSTER=${var.name}" >> /etc/ecs/ecs.config
    echo "ECS_ENABLE_TASK_IAM_ROLE=true" >> /etc/ecs/ecs.config
    echo "ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true" >> /etc/ecs/ecs.config
  EOT
  )
}

resource "aws_launch_template" "this" {
  name_prefix   = "${var.name}-ecs-"
  image_id      = data.aws_ssm_parameter.ecs_ami.value
  instance_type = var.instance_type
  user_data     = local.user_data

  iam_instance_profile {
    arn = var.instance_profile_arn
  }

  vpc_security_group_ids = [var.app_security_group_id]

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required" # IMDSv2 only
  }

  monitoring {
    enabled = true
  }

  update_default_version = true

  tag_specifications {
    resource_type = "instance"
    tags          = merge(var.tags, { Name = "${var.name}-ecs-node" })
  }
}

resource "aws_autoscaling_group" "this" {
  name                  = "${var.name}-ecs-asg"
  vpc_zone_identifier   = var.app_subnet_ids
  min_size              = var.min_size
  max_size              = var.max_size
  desired_capacity      = var.desired_capacity
  protect_from_scale_in = true # required by managed_termination_protection
  health_check_type     = "EC2"

  launch_template {
    id      = aws_launch_template.this.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.name}-ecs-node"
    propagate_at_launch = true
  }

  tag {
    key                 = "AmazonECSManaged"
    value               = "true"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_ecs_capacity_provider" "this" {
  name = "${var.name}-cp"

  auto_scaling_group_provider {
    auto_scaling_group_arn         = aws_autoscaling_group.this.arn
    managed_termination_protection = "ENABLED"

    managed_scaling {
      status          = "ENABLED"
      target_capacity = 100
    }
  }

  tags = merge(var.tags, { Name = "${var.name}-cp" })
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = [aws_ecs_capacity_provider.this.name]

  default_capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.this.name
    weight            = 1
    base              = 1
  }
}

# ── Placeholder task definition (bootstrap only; CI owns real revisions) ────
resource "aws_ecs_task_definition" "placeholder" {
  family                   = var.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["EC2"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name         = var.container_name
      image        = var.placeholder_image
      essential    = true
      portMappings = [{ containerPort = var.container_port, protocol = "tcp" }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "placeholder"
        }
      }
    }
  ])

  tags = merge(var.tags, { Name = "${var.name}-placeholder" })
}

# ── Service ────────────────────────────────────────────────────────────────
resource "aws_ecs_service" "this" {
  name            = "${var.name}-app"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.placeholder.arn
  desired_count   = var.desired_count

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.this.name
    weight            = 1
    base              = 1
  }

  network_configuration {
    subnets         = var.app_subnet_ids
    security_groups = [var.app_security_group_id]
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = var.container_name
    container_port   = var.container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true # auto-roll-back a failed deployment
  }

  health_check_grace_period_seconds = var.health_check_grace_period_seconds

  ordered_placement_strategy {
    type  = "spread"
    field = "attribute:ecs.availability-zone"
  }

  enable_execute_command = true

  # CI owns the running task definition; autoscaling owns desired_count.
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_ecs_cluster_capacity_providers.this]
}

# ── Service autoscaling (optional) ─────────────────────────────────────────
resource "aws_appautoscaling_target" "ecs" {
  count              = var.enable_service_autoscaling ? 1 : 0
  max_capacity       = var.max_size
  min_capacity       = var.desired_count
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  count              = var.enable_service_autoscaling ? 1 : 0
  name               = "${var.name}-cpu-target-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.autoscaling_cpu_target
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
