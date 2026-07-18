# Remote state in S3 with a DynamoDB lock.
#
# tfstate contains secret material (e.g. the RDS master secret ARN and, for
# later phases, generated values), so it lives in an encrypted, access-
# restricted bucket — NEVER in git. The root .gitignore already excludes
# *.tfstate and .terraform/.
#
# Bootstrap once, out of band, before `terraform init` (see IMPLEMENTATION_PHASES.md
# Phase 0). The bucket name embeds the AWS account id, so it is supplied via a
# gitignored partial-config file — keep it out of the public repo:
#   terraform init -backend-config=backend.hcl
# (Copy backend.hcl.example → backend.hcl and set the bucket.)
terraform {
  backend "s3" {
    # bucket comes from backend.hcl (partial config — not in git)
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "acs-tflock"
    encrypt        = true
  }
}
