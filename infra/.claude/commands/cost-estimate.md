---
description: Estimate monthly AWS cost for the deployed stack
---
Read the Terraform files and produce a monthly cost estimate in USD. Break it down by resource type:

| Resource | Type / Size | Est. monthly cost |
|---|---|---|
| EC2 | (instance type from variables.tf) | $X |
| RDS PostgreSQL | (instance type, storage) | $X |
| ALB | per LCU | $X |
| ACM certificate | N/A | $0 (free) |
| Secrets Manager | per secret + API calls | $X |
| NAT Gateway | per GB + hour | $X |
| Data transfer | estimated egress | $X |
| CloudWatch Logs | estimated volume | $X |
| **Total** | | **$X** |

Notes:
- Use us-east-1 on-demand pricing unless variables.tf sets a different region.
- For the take-home grading period (days, not months), the actual cost is far lower — flag the
  daily estimate too so it's clear what running this costs during demo.
- Highlight any resource that could be downsized post-challenge without affecting the demo (e.g.,
  RDS `db.t3.micro` vs `db.t3.small`).
