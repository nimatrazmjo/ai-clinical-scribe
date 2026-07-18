variable "name" {
  type        = string
  description = "Name prefix for the ALB and target group."
}

variable "vpc_id" {
  type        = string
  description = "VPC id for the target group."
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public subnet ids for the internet-facing ALB (>= 2 AZs)."
}

variable "alb_sg_id" {
  type        = string
  description = "Security group for the ALB (alb-sg)."
}

variable "target_port" {
  type        = number
  default     = 80
  description = "Container port the TG routes to (the nginx web container)."
}

variable "health_check_path" {
  type        = string
  default     = "/"
  description = "Target group health-check path (SPA index returns 200)."
}

variable "enable_https" {
  type        = bool
  default     = false
  description = "Create the HTTPS:443 listener + 80→443 redirect. Keep in sync with certificate_arn."
}

variable "certificate_arn" {
  type        = string
  default     = ""
  description = "ACM cert ARN used by the HTTPS listener (may be computed in the same apply)."
}

variable "ssl_policy" {
  type        = string
  default     = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  description = "ALB SSL negotiation policy for the HTTPS listener."
}

variable "idle_timeout" {
  type        = number
  default     = 300
  description = "ALB idle timeout (seconds). High enough not to cut SSE streams."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto the ALB and target group."
}
