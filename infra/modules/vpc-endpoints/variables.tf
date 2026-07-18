variable "name" {
  type        = string
  description = "Name prefix for the endpoints and their SG."
}

variable "vpc_id" {
  type        = string
  description = "VPC to create the endpoints in."
}

variable "region" {
  type        = string
  description = "AWS region (builds the com.amazonaws.<region>.<service> names)."
}

variable "app_subnet_ids" {
  type        = list(string)
  description = "Subnets to place the interface endpoint ENIs in (the app tier)."
}

variable "app_security_group_id" {
  type        = string
  description = "App SG allowed to reach the endpoints on 443."
}

variable "route_table_ids" {
  type        = list(string)
  description = "Route tables to attach the S3 gateway endpoint to (the app route tables)."
}

variable "interface_services" {
  type        = list(string)
  default     = ["ecr.api", "ecr.dkr", "secretsmanager", "logs", "ssm", "ssmmessages"]
  description = "Interface endpoint services (short names)."
}

variable "tags" {
  type    = map(string)
  default = {}
}
