variable "name" {
  type        = string
  description = "Name prefix for all security groups (e.g. acs-prod)."
}

variable "vpc_id" {
  type        = string
  description = "VPC the security groups belong to."
}

variable "alb_ingress_cidrs" {
  type        = list(string)
  default     = ["0.0.0.0/0"]
  description = "CIDRs allowed to reach the ALB on 443/80. Narrow this to office IPs for a private demo."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto every security group."
}
