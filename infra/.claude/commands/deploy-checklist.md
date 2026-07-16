---
description: Pre-submission infra checklist against the challenge rubric
---
Check off, with evidence (command output or file reference), each of: valid CA-issued TLS cert
(not self-signed); nginx in front of the app, app not bound to 80/443 directly; RDS not publicly
accessible, VPC-only ingress; all secrets in Secrets Manager/Parameter Store, none hardcoded or in
a committed .env; app-side connection pooling configured. Report as pass/fail, not prose.
