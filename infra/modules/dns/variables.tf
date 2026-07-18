variable "name" {
  type        = string
  description = "Name prefix for tags."
}

variable "domain_name" {
  type        = string
  description = "App FQDN the cert is issued for (e.g. scribe.example.com)."
}

variable "hosted_zone_name" {
  type        = string
  description = "Route 53 zone that holds the record (e.g. example.com)."
}

variable "create_hosted_zone" {
  type        = bool
  default     = false
  description = "Create the hosted zone (then delegate NS at your registrar). false = reuse an existing zone."
}

variable "subject_alternative_names" {
  type        = list(string)
  default     = []
  description = "Extra SANs on the cert (e.g. a www or apex alias)."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto zone/cert."
}
