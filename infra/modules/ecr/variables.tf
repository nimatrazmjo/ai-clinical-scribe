variable "name" {
  type        = string
  description = "Name prefix; repos are created as <name>/<repository> (e.g. acs-prod/api)."
}

variable "repositories" {
  type        = list(string)
  default     = ["api", "web"]
  description = "Image repositories to create. web = nginx + built SPA sidecar."
}

variable "image_tag_mutability" {
  type        = string
  default     = "IMMUTABLE"
  description = "IMMUTABLE gives deterministic rollback (a SHA tag can never move). Use MUTABLE only if you insist on a floating latest."
}

variable "max_image_count" {
  type        = number
  default     = 30
  description = "How many recent images to retain per repo — this is your rollback horizon."
}

variable "untagged_expire_days" {
  type        = number
  default     = 7
  description = "Expire untagged (orphaned) layers after this many days."
}

variable "force_delete" {
  type        = bool
  default     = false
  description = "Allow `terraform destroy` to delete repos that still contain images. Keep false in prod."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto every repository."
}
