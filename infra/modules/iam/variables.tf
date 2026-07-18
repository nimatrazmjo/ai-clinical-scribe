variable "name" {
  type        = string
  description = "Name prefix for the roles/instance profile."
}

variable "app_secret_arns" {
  type        = list(string)
  default     = []
  description = "App secret ARNs the execution role may read. Empty = no secrets policy attached."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto the roles."
}
