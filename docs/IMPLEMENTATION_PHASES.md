# AI Clinical Scribe — Phased Infrastructure Implementation

Companion to `DEPLOYMENT_PLAN.md`. That doc is the *what and why*; this is the *order of operations*. Each phase is independently applyable, has an explicit exit criterion, and maps back to the grading rubric so you always know what you can demo after it.

**Delivered in this scaffold:** Phases 0–3 (state, network, security, data). Phases 4–7 are specified here as the forward plan.

```
Phase 0  Remote state           (one-time bootstrap)
Phase 1  Network                ─┐
Phase 2  Security groups         │  ← this delivery (infra/modules + envs/prod)
Phase 3  Data / RDS             ─┘
Phase 4  Secrets + IAM
Phase 5  Edge (ALB) + DNS + ACM/TLS
Phase 6  Compute (ECS-on-EC2, nginx sidecar, migration task)
Phase 7  Observability + hardening
```

All applies run from `infra/envs/prod`. Use the existing runbooks under `infra/.claude/commands/` (`tf-plan`, `sg-audit`, `tls-verify`, `deploy-checklist`, `rotate-secret`, `cost-estimate`) as the operational checklist at each gate.

---

## Phase 0 — Remote state (bootstrap, once)

**Goal:** a versioned, encrypted, lockable home for tfstate before any resource exists. State will hold secret material, so it never lives in git.

**Do:**
- Create an S3 bucket (globally unique, versioned, SSE, public access blocked) and a DynamoDB lock table (`acs-tflock`, PK `LockID`). Do this out of band — `aws` CLI or a tiny separate Terraform config with a *local* backend, since you can't store state in a bucket that doesn't exist yet.
- Put the bucket name in `envs/prod/backend.tf` (replace `acs-tfstate-CHANGE_ME`).

**Exit:** `terraform init` in `envs/prod` succeeds and reports the S3 backend.

---

## Phase 1 — Network  ✅ (this delivery)

**Goal:** a three-tier VPC where the data tier has no path to the internet.

**Resources** (`modules/network`): VPC, IGW, 2×{public, private-app, private-data} subnets, EIP+NAT (single by default), and route tables — public→IGW, app→NAT, **data→nothing**.

**Apply:**
```bash
cd infra/envs/prod
terraform init
terraform apply -target=module.network
```

**Validate / exit:**
- `terraform output` shows 2 subnet ids per tier.
- The **data route table has no `0.0.0.0/0` route** — this is half of the "RDS is private" proof, independent of any security group. Show it:
  ```bash
  aws ec2 describe-route-tables \
    --filters Name=tag:Name,Values=acs-prod-rt-data \
    --query 'RouteTables[].Routes'
  ```
  Expect only the local VPC route.

**Rubric tie-in:** structural foundation for #7.

---

## Phase 2 — Security groups  ✅ (this delivery)

**Goal:** least-privilege, SG-by-reference wiring for the whole request path.

**Resources** (`modules/security`): `alb-sg`, `app-sg`, `db-sg`, `rdsproxy-sg`, each rule a discrete resource with a description. Only wildcard ingress is 443/80 on the ALB; `db-sg` has ingress from app/proxy only and **no egress**.

**Apply:**
```bash
terraform apply -target=module.security
```

**Validate / exit (`sg-audit`):**
- `db-sg` ingress references `app-sg`/`rdsproxy-sg` by id — no CIDRs.
- No `0.0.0.0/0` ingress on any SG except the ALB.
  ```bash
  aws ec2 describe-security-groups \
    --filters Name=group-name,Values=acs-prod-db-sg \
    --query 'SecurityGroups[].IpPermissions'
  ```

**Rubric tie-in:** the access-control half of #7; the SG scaffolding for #6.

---

## Phase 3 — Data / RDS  ✅ (this delivery)

**Goal:** a private, encrypted Postgres 16 with credentials in Secrets Manager — the provable "private RDS" story you asked to land first.

**Resources** (`modules/data`): DB subnet group (data subnets), parameter group (`rds.force_ssl=1`), `aws_db_instance` (`publicly_accessible=false`, `storage_encrypted=true`, `manage_master_user_password=true`), and an **optional** RDS Proxy (off by default).

**Apply:**
```bash
terraform apply        # full env now that all three modules are wired
```

**Validate / exit:**
- `aws rds describe-db-instances --db-instance-identifier acs-prod-postgres --query 'DBInstances[0].PubliclyAccessible'` → `false`.
- The instance sits only in the data subnets; its SG is `db-sg`.
- Master secret exists in Secrets Manager, and **no password appears in code or `terraform show`** (only the secret ARN).
- Negative test: a `psql` from outside the VPC times out; from an app-subnet host (SSM/bastion in a later phase) it connects.
- Enable extensions once reachable: `CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS vector;` (the app migrations also do this).

**Rubric tie-in:** #2 (data in RDS), #7 (not public), and the storage half of #5 (managed secret).

> **Staged vs one-shot:** the `-target` applies above are for demoing each tier in isolation. In normal use just run `terraform apply` — module dependencies order it correctly.

---

## Phase 4 — Secrets + IAM

**Goal:** every runtime secret in Secrets Manager, reachable only by least-privilege roles.

**Resources:** Secrets Manager entries for `DATABASE_URL` (least-priv app role, not master), `ANTHROPIC_API_KEY`, `JWT_SECRET`; a dedicated app DB role created in the instance (bootstrap SQL/migration); IAM **execution role** (`GetSecretValue` on exactly those ARNs + `kms:Decrypt`) and **task role** (runtime-only). No `AdministratorAccess` anywhere.

**Exit:** `aws secretsmanager list-secrets` shows the three app secrets; the execution-role policy resource-scopes to their ARNs; `git grep` for secret values is empty. **Rubric #5.**

---

## Phase 5 — Edge + DNS + TLS  ✅ (scaffolded)

**Goal:** public HTTPS with a valid ACM cert.

**Resources:** the ALB/target group/listeners live in `modules/edge` (Phase 6 delivery); `modules/dns` adds the Route 53 hosted zone (create or reuse) + DNS-validated `aws_acm_certificate` + `aws_acm_certificate_validation`; the env root adds the `A`/ALIAS record → ALB. HTTPS is **off by default** and switches on the moment you set `domain_name` + `hosted_zone_name`.

**Turn it on:**
```hcl
# terraform.tfvars
domain_name        = "scribe.example.com"
hosted_zone_name   = "example.com"
create_hosted_zone = false   # true if the zone isn't already in Route 53
```
Then `terraform apply`. If `create_hosted_zone = true`, delegate the `route53_name_servers` output at your registrar and re-apply so ACM can validate.

**Design notes:**
- The HTTPS listener `count` keys off a static `enable_https` flag (derived from the domain vars), not the cert ARN — so the plan is stable even though the cert is created in the same apply.
- The cert comes from `aws_acm_certificate_validation`, so the ALB listener only attaches an **issued** cert.
- The ALIAS record sits at the env root, so `dns` and `edge` don't form a dependency cycle.

**Exit (`tls-verify`):** `curl -vI https://<domain>` shows a valid Amazon-issued chain; HTTP 301-redirects to HTTPS; `terraform output app_url` prints the `https://` URL. **Rubric #1.**

---

## Phase 6 — Compute (ECS-on-EC2)

**Goal:** the app running on EC2 behind nginx, with migrations handled safely.

**Resources:** ECR repos (api, nginx); ECS cluster + EC2 capacity provider (ASG, ECS-optimized AMI) in private-app subnets; task definition with an **nginx sidecar** (:80 → api :3000 on loopback) and a `secrets[]` block pulling Phase-4 ARNs; ECS service wired to the ALB target group with deployment circuit breaker + autoscaling; a **one-shot migration task** (`RunTask`) run before rollout, with the service containers gated `RUN_MIGRATIONS=false`.

**Exit (`deploy-checklist`):** healthy targets; `ss -ltnp` in the task shows the API on 3000 only (never 80/443); the SPA loads over HTTPS and `/api` streams. **Rubric #1, #4, #6.** Flip `enable_rds_proxy=true` here so the app connects through the proxy.

---

## Phase 7 — Observability + hardening  ✅ (scaffolded)

**Goal:** production-grade operations and the "what would you add" answer. Each control is an independently toggleable module.

- **RDS Proxy** (`enable_rds_proxy = true`) — pools/multiplexes DB connections and smooths failover. Point `DATABASE_URL` at `terraform output rds_proxy_endpoint` to route the app through it.
- **Multi-AZ RDS** (`db_multi_az = true`) — synchronous standby + automatic failover.
- **WAF** (`modules/waf`, `enable_waf = true`) — regional WAFv2 on the ALB: AWS common + known-bad-inputs managed rules and a per-IP rate limit.
- **Alarms** (`modules/observability`, `enable_alarms = true`) — SNS topic + CloudWatch alarms for ALB 5xx / unhealthy hosts, RDS CPU / free storage / connections, and ECS CPU / memory. Set `alarm_email` (or subscribe Slack/PagerDuty to `alarms_sns_topic_arn`).
- **VPC endpoints** (`modules/vpc-endpoints`, `enable_vpc_endpoints = true`) — ECR (api+dkr), Secrets Manager, Logs, SSM interface endpoints + free S3 gateway; keeps pulls/secrets off NAT. Each interface endpoint bills hourly, so weigh against NAT savings.
- Already on from earlier phases: Container Insights, per-container log groups with retention, RDS Performance Insights, IMDSv2-only instances, `rds.force_ssl`.

**Exit:** alarms firing to a subscribed endpoint; `terraform output` shows `waf_web_acl_arn` + `alarms_sns_topic_arn`; `cost-estimate` reconciled; teardown verified (`terraform destroy`, deletion protection off in non-prod).

> Still open: **CloudFront/CDN** in front of the ALB, **ALB access logs to S3**, and **secret rotation** (`rotate-secret`) — natural follow-ons, not built here.

---

## CI/CD pipeline (delivered)

Merge to `main` builds images, pushes to ECR, and rolls the ECS service; a separate workflow rolls back. Auth is GitHub **OIDC** — no static AWS keys in GitHub.

**Applyable now:** `module.ecr` and `module.github_oidc` have no dependency on the ECS service, so `terraform apply` builds them today and the **build → push** half of the pipeline works immediately. The **deploy** half targets the Phase 6 service (`ECS_CLUSTER` / `ECS_SERVICE` / `TASK_FAMILY`), so it goes green once compute exists.

**Files:**
- `.github/workflows/deploy.yml` — on push to `main`: OIDC auth → build `api` + `web` images → push to ECR with an **immutable git-SHA tag** → render `task-definition.json` → register → (optional) migration task → `update-service` → wait for stable.
- `.github/workflows/rollback.yml` — `workflow_dispatch`: blank input rolls back to the **previous task-definition revision**; a git SHA input redeploys that exact image.
- `infra/deploy/ecs/task-definition.json` — the task shape (nginx `web` sidecar + `api`, secrets by ARN, awslogs). CI fills images/ARNs via `envsubst`.

**Ownership boundary (avoids the classic ECS + Terraform + CI fight):** Terraform owns the cluster, service, ALB, and roles; **CI owns the image tag**. Set `lifecycle { ignore_changes = [task_definition] }` on the Phase 6 `aws_ecs_service` so Terraform doesn't revert what CI deploys. ARNs in the task-def template are not secrets; the secret *values* stay in Secrets Manager.

**Rollback model (two layers):**
1. *Automatic* — the ECS deployment **circuit breaker** (set on the Phase 6 service) rolls a failed deploy back to the last stable task def; `aws ecs wait services-stable` then fails the pipeline.
2. *Manual* — run **Rollback ECS deployment**. Blank tag = previous revision (fastest undo). A git SHA = pin to any image still inside the ECR rollback horizon (`max_image_count`, default 30). Immutable tags mean a SHA always resolves to the same bytes.

> Migrations must be **backward-compatible** (expand/contract): rolling the image back does not roll the schema back. Keep each migration safe against the previous image.

**Required GitHub Actions repo variables** (Settings → Secrets and variables → Actions → *Variables*; all non-secret — populate from `terraform output`):

| Variable | Source | Example |
|---|---|---|
| `AWS_REGION` | chosen | `us-east-1` |
| `AWS_ACCOUNT_ID` | `terraform output aws_account_id` | `123456789012` |
| `AWS_DEPLOY_ROLE_ARN` | `terraform output github_actions_role_arn` | `arn:aws:iam::…:role/acs-prod-github-actions-deploy` |
| `NAME_PREFIX` | `var.name` | `acs-prod` |
| `ECS_CLUSTER` / `ECS_SERVICE` / `TASK_FAMILY` | Phase 6 outputs | `acs-prod` / `acs-prod-api` / `acs-prod` |
| `EXECUTION_ROLE_ARN` / `TASK_ROLE_ARN` | Phase 4/6 outputs | `arn:aws:iam::…:role/…` |
| `DATABASE_URL_ARN` / `ANTHROPIC_API_KEY_ARN` / `JWT_SECRET_ARN` | Phase 4 outputs | Secrets Manager ARNs |
| `APP_SUBNET_IDS` | `terraform output app_subnet_ids` (comma-joined) | `subnet-aaa,subnet-bbb` |
| `APP_SECURITY_GROUP_ID` | `terraform output app_sg_id` | `sg-0abc…` |
| `VITE_API_URL` | optional | *(blank — nginx proxies `/api`)* |
| `RUN_DB_MIGRATIONS` | optional | *(unset = migrate each deploy; `false` to skip)* |

**Before the first run:** set `github_repo` in `terraform.tfvars`, `terraform apply` (creates ECR + the OIDC deploy role), then populate the variables above. Build/push works right away; deploy activates with Phase 6.

---

## Bring-up: Phases 4–6 (scaffolded)

The `secrets`, `iam`, `edge`, and `compute` modules are now wired into `envs/prod`, so `terraform apply` stands up the full runtime and the CI **deploy** job runs end to end. What each adds:

- **secrets** — Secrets Manager *containers* for `DATABASE_URL`, `ANTHROPIC_API_KEY`, `JWT_SECRET`. Containers only; **you seed the values once, out of band** (never in code/state):
  ```bash
  aws secretsmanager put-secret-value --secret-id acs-prod/DATABASE_URL \
    --secret-string 'postgres://app_user:<pw>@<rds-endpoint>:5432/clinical_scribe'
  aws secretsmanager put-secret-value --secret-id acs-prod/ANTHROPIC_API_KEY --secret-string 'sk-ant-...'
  aws secretsmanager put-secret-value --secret-id acs-prod/JWT_SECRET --secret-string "$(openssl rand -hex 32)"
  ```
  Create the least-privilege `app_user` in RDS (not the master) and put its DSN in `DATABASE_URL`.
- **iam** — EC2 instance role (join ECS, pull ECR, SSM), execution role (pull + read exactly those three secrets + logs), task role (ECS Exec).
- **edge** — internet-facing ALB → target group → the task's nginx `web` container. **HTTP:80 today**; set `certificate_arn` (Phase 5 with a domain) to switch on HTTPS:443 + the 80→443 redirect and satisfy rubric #1.
- **compute** — ECS cluster, EC2 ASG + capacity provider, and the service (awsvpc, **deployment circuit breaker + rollback**, `ignore_changes=[task_definition,desired_count]`). It boots on a **placeholder nginx** image so targets are healthy before the first pipeline deploy; CI then swaps in the real `web`+`api` images.

**End-to-end order:** `terraform apply` → seed the three secret values → set the GitHub repo variables from `terraform output` (`ecs_cluster_name`, `ecs_service_name`, `task_family`, `execution_role_arn`, `task_role_arn`, `app_secret_arns`, `github_actions_role_arn`, `aws_account_id`, `alb_dns_name`) → merge to `main`. The pipeline builds, pushes, and deploys; the app is reachable at `http://<alb_dns_name>`.

> Phases 5 (Route 53 + ACM) and 7 (RDS Proxy, Multi-AZ, WAF, alarms, VPC endpoints) are now wired — enable them with the variables in their sections. The one-off **migration task** runs automatically each deploy (`node dist/migrate`, advisory-locked).

---

## Rubric coverage by phase

| Requirement | Landed in |
|---|---|
| #1 HTTPS + valid cert | Phase 5 (+6 for the app behind it) |
| #2 Data in RDS | Phase 3 |
| #3 Normalized schema / ERD | app migrations (see `DEPLOYMENT_PLAN.md` §7.2) |
| #4 Connection pooling | app (`poolSize`) + Phase 6 sizing + Phase 7 RDS Proxy |
| #5 Secrets in Secrets Manager | Phase 3 (master) + Phase 4 (app secrets/IAM) |
| #6 nginx reverse proxy, app off 80/443 | Phase 6 (sidecar) + Phase 2 (SGs) |
| #7 RDS not public | Phases 1–3 (isolated subnets + SGs + `publicly_accessible=false`) |
