variable "name" {
  type        = string
  description = "Name prefix for all network resources (e.g. acs-prod)."
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "CIDR block for the VPC."
}

variable "az_count" {
  type        = number
  default     = 2
  description = "Number of AZs to span. Must be <= number of subnet CIDRs in each list."

  validation {
    condition     = var.az_count >= 2
    error_message = "az_count must be at least 2 (ALB and RDS both require multi-AZ subnets)."
  }
}

variable "public_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.0.0/24", "10.0.1.0/24"]
  description = "One CIDR per AZ for the public (ALB/NAT) tier."
}

variable "app_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
  description = "One CIDR per AZ for the private-app (ECS/EC2) tier."
}

variable "data_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.20.0/24", "10.0.21.0/24"]
  description = "One CIDR per AZ for the private-data (RDS) tier."
}

variable "enable_nat_gateway" {
  type        = bool
  default     = true
  description = "Provision NAT for private-app egress (image pulls, Secrets Manager, LLM API)."
}

variable "single_nat_gateway" {
  type        = bool
  default     = true
  description = "true = one shared NAT (cheaper); false = one NAT per AZ (HA)."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto every resource (project/env come from provider default_tags)."
}
