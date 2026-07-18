variable "name" {
  type        = string
  description = "Name prefix; secrets are created as <name>/<SECRET_NAME>."
}

variable "secret_names" {
  type        = list(string)
  default     = ["DATABASE_URL", "ANTHROPIC_API_KEY", "JWT_SECRET"]
  description = "Logical names of the app secrets to create containers for."
}

variable "recovery_window_in_days" {
  type        = number
  default     = 7
  description = "Deletion recovery window. Set 0 in throwaway demo accounts for immediate delete/recreate."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto every secret."
}
