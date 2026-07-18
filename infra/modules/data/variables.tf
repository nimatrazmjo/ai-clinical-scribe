variable "name" {
  type        = string
  description = "Name prefix for all data resources (e.g. acs-prod)."
}

variable "data_subnet_ids" {
  type        = list(string)
  description = "Private-data subnet ids (>= 2 AZs) for the DB subnet group and proxy."
}

variable "db_security_group_id" {
  type        = string
  description = "Security group attached to the RDS instance (db-sg)."
}

variable "rdsproxy_security_group_id" {
  type        = string
  description = "Security group attached to the RDS Proxy (rdsproxy-sg)."
}

variable "engine_version" {
  type        = string
  default     = "16"
  description = "Postgres major/minor version. 16 matches the local pgvector image."
}

variable "instance_class" {
  type        = string
  default     = "db.t4g.small"
  description = "RDS instance class. t4g.small supports Performance Insights; micro/nano do not."
}

variable "allocated_storage" {
  type        = number
  default     = 20
  description = "Initial gp3 storage (GB)."
}

variable "max_allocated_storage" {
  type        = number
  default     = 100
  description = "Storage-autoscaling ceiling (GB). Set equal to allocated_storage to disable."
}

variable "db_name" {
  type        = string
  default     = "clinical_scribe"
  description = "Initial database name."
}

variable "master_username" {
  type        = string
  default     = "scribe_admin"
  description = "Master username. Break-glass only — the app uses a least-priv role."
}

variable "kms_key_arn" {
  type        = string
  default     = null
  description = "CMK for storage encryption. null uses the AWS-managed RDS key."
}

variable "multi_az" {
  type        = bool
  default     = false
  description = "Multi-AZ failover. true for the production defense; false saves ~cost for the demo."
}

variable "backup_retention_period" {
  type        = number
  default     = 7
  description = "Automated backup retention in days."
}

variable "deletion_protection" {
  type        = bool
  default     = false
  description = "Block accidental deletion. Turn on for a long-lived prod instance."
}

variable "skip_final_snapshot" {
  type        = bool
  default     = true
  description = "Skip the final snapshot on destroy. false = take one named <name>-final."
}

variable "apply_immediately" {
  type        = bool
  default     = false
  description = "Apply modifications now instead of during the maintenance window."
}

variable "enable_performance_insights" {
  type        = bool
  default     = true
  description = "Enable Performance Insights (unsupported on micro/nano classes)."
}

variable "enable_rds_proxy" {
  type        = bool
  default     = false
  description = "Provision RDS Proxy in front of the instance."
}

variable "proxy_max_connections_percent" {
  type        = number
  default     = 75
  description = "RDS Proxy: max % of DB max_connections the proxy pool may use."
}

variable "proxy_max_idle_connections_percent" {
  type        = number
  default     = 50
  description = "RDS Proxy: max % of connections kept idle in the pool."
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Extra tags merged onto every data resource."
}
