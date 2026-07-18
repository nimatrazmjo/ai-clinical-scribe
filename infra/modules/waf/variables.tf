variable "name" {
  type        = string
  description = "Name prefix for the web ACL."
}

variable "alb_arn" {
  type        = string
  description = "ARN of the ALB to associate the web ACL with."
}

variable "rate_limit" {
  type        = number
  default     = 2000
  description = "Max requests per 5-minute window per source IP before blocking."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto the web ACL."
}
