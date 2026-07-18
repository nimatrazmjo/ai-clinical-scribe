# Remote state in S3 with a DynamoDB lock.
#
# tfstate contains secret material (e.g. the RDS master secret ARN and, for
# later phases, generated values), so it lives in an encrypted, access-
# restricted bucket — NEVER in git. The root .gitignore already excludes
# *.tfstate and .terraform/.
#
# Bootstrap once, out of band, before `terraform init` (see IMPLEMENTATION_PHASES.md
# Phase 0). The bucket name must be globally unique — set it below.
terraform {
  backend "s3" {
    bucket         = "acs-tfstate-CHANGE_ME" # ← set to your globally-unique bucket
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "acs-tflock"
    encrypt        = true
  }
}
