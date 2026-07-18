# ── Secrets module (Phase 4-lite) ──────────────────────────────────────────
# Creates the Secrets Manager *containers* the app task references. Values are
# set out of band (see IMPLEMENTATION_PHASES.md Phase 4), so no secret value
# ever lands in Terraform code or state — only ARNs, which are not sensitive.
#
#   aws secretsmanager put-secret-value --secret-id acs-prod/DATABASE_URL \
#     --secret-string 'postgres://app_user:...@<rds-endpoint>:5432/clinical_scribe'

resource "aws_secretsmanager_secret" "this" {
  for_each = toset(var.secret_names)

  name                    = "${var.name}/${each.value}"
  description             = "App secret ${each.value} for ${var.name}. Value set out of band — never in code/state."
  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.tags, { Name = "${var.name}/${each.value}" })
}
