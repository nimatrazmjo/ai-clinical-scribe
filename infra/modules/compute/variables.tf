variable "name" {
  type        = string
  description = "Name prefix. Also the ECS cluster name and task-definition family (GH var TASK_FAMILY)."
}

variable "app_subnet_ids" {
  type        = list(string)
  description = "Private-app subnet ids for the ASG and the awsvpc tasks."
}

variable "app_security_group_id" {
  type        = string
  description = "app-sg — attached to both the EC2 instances and the task ENIs."
}

variable "target_group_arn" {
  type        = string
  description = "ALB target group the service registers the web container into."
}

variable "instance_profile_arn" {
  type        = string
  description = "EC2 instance profile ARN (from the iam module)."
}

variable "execution_role_arn" {
  type        = string
  description = "ECS task execution role ARN."
}

variable "task_role_arn" {
  type        = string
  description = "ECS task role ARN."
}

variable "container_name" {
  type        = string
  default     = "web"
  description = "Container the ALB targets. Must match the web container in task-definition.json."
}

variable "container_port" {
  type        = number
  default     = 80
  description = "Port the web (nginx) container listens on."
}

variable "placeholder_image" {
  type        = string
  default     = "public.ecr.aws/nginx/nginx:stable-alpine"
  description = "Bootstrap image so the service is healthy before the first CI deploy."
}

variable "instance_type" {
  type        = string
  default     = "t3.small"
  description = "EC2 instance type. Must match the image arch built in CI (amd64 by default)."
}

variable "ecs_ami_ssm_parameter" {
  type        = string
  default     = "/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id"
  description = "SSM parameter for the ECS-optimized AMI. Use the arm64 path for Graviton instances."
}

variable "min_size" {
  type    = number
  default = 1
}

variable "max_size" {
  type    = number
  default = 2
}

variable "desired_capacity" {
  type        = number
  default     = 1
  description = "ASG desired EC2 instance count."
}

variable "desired_count" {
  type        = number
  default     = 1
  description = "ECS service desired task count."
}

variable "health_check_grace_period_seconds" {
  type    = number
  default = 60
}

variable "log_group_prefix" {
  type        = string
  default     = "/acs/prod"
  description = "Log group prefix. Must match task-definition.json (/acs/prod/web, /acs/prod/api)."
}

variable "log_retention_days" {
  type    = number
  default = 14
}

variable "enable_service_autoscaling" {
  type    = bool
  default = false
}

variable "autoscaling_cpu_target" {
  type    = number
  default = 60
}

variable "tags" {
  type    = map(string)
  default = {}
}
