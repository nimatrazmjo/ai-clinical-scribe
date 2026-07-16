---
description: Run and summarize a Terraform plan without applying
---
Run `terraform plan` in `infra/`. Summarize additions/changes/destructions in plain language. Flag
anything that would make RDS publicly accessible, open a security group to 0.0.0.0/0 on a port
other than 443, or grant IAM more than the app needs. Do not run `terraform apply` — that requires
my explicit confirmation first.
