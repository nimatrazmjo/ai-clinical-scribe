variable "name" {
  type        = string
  description = "Name prefix for the SNS topic and alarms."
}

variable "alb_arn_suffix" {
  type        = string
  description = "ALB ARN suffix (aws_lb.arn_suffix) for CloudWatch dimensions."
}

variable "target_group_arn_suffix" {
  type        = string
  description = "Target group ARN suffix for the unhealthy-hosts alarm."
}

variable "db_instance_identifier" {
  type        = string
  description = "RDS DBInstanceIdentifier for RDS alarms."
}

variable "ecs_cluster_name" {
  type        = string
  description = "ECS cluster name for ECS alarms."
}

variable "ecs_service_name" {
  type        = string
  description = "ECS service name for ECS alarms."
}

variable "alarm_email" {
  type        = string
  default     = ""
  description = "Optional email subscribed to the alarm topic (confirm the subscription email)."
}

variable "alb_5xx_threshold" {
  type    = number
  default = 5
}

variable "rds_cpu_threshold" {
  type    = number
  default = 80
}

variable "rds_free_storage_threshold_bytes" {
  type        = number
  default     = 2147483648 # 2 GiB
  description = "Alarm when RDS free storage drops below this many bytes."
}

variable "rds_connections_threshold" {
  type        = number
  default     = 150
  description = "Alarm when DatabaseConnections exceeds this (size vs the instance's max_connections)."
}

variable "ecs_cpu_threshold" {
  type    = number
  default = 80
}

variable "ecs_memory_threshold" {
  type    = number
  default = 80
}

variable "tags" {
  type    = map(string)
  default = {}
}
