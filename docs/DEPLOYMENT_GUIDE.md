# Deployment Guide — AI Clinical Scribe → AWS + GitHub

Step-by-step, assume-nothing runbook to take this repo from a laptop to a live,
HTTPS-capable app on AWS, with GitHub Actions doing the builds/deploys.

If you get stuck, every architectural *why* is in
[`infra/DEPLOYMENT_PLAN.md`](../infra/DEPLOYMENT_PLAN.md); the phase-by-phase
*what* is in [`infra/IMPLEMENTATION_PHASES.md`](../infra/IMPLEMENTATION_PHASES.md).
This guide is the *how*, in order, with copy-pasteable commands.

---

## 0. Mental model (read this once)

There are **two systems** and they hand off to each other:

```
  Terraform  ──builds──▶  the AWS "shell" (VPC, RDS, ALB, ECS cluster+service,
                          IAM roles, ECR repos, Secrets containers, OIDC trust)

  GitHub Actions ──builds & ships──▶  the app itself (docker images → ECR →
                          new ECS task definition → rolling deploy)
```

Terraform stands up empty infrastructure. The ECS service boots on a **placeholder
nginx image** so it's healthy from day one. Then you push to `main`, and GitHub
Actions builds the real `api` + `web` images and swaps them in. Terraform never
touches the running image again (that's CI's job) — the service has
`ignore_changes = [task_definition]` for exactly that reason.

**Order of the whole thing:**

1. Install tools, configure AWS + GitHub.
2. Bootstrap the Terraform remote state bucket (one time).
3. `terraform apply` → the AWS shell exists.
4. Seed the 3 secret *values* into Secrets Manager (out of band, never in code).
5. Wire GitHub repo variables from `terraform output`.
6. `git push` to `main` → CI builds, migrates, deploys.
7. Verify. (Optional) turn on a real domain + HTTPS. (Optional) hardening. Teardown.

---

## 1. Prerequisites

### 1.1 Tools to install

On this machine right now: `aws` ✅ and `docker` ✅ are present, but **`terraform`
and `gh` are missing**, and the repo has **no GitHub remote yet**. Install the two
missing tools:

```bash
# Terraform (via Homebrew)
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# GitHub CLI (optional but makes step 5 one-liners; you can use the web UI instead)
brew install gh

# verify
terraform version      # want >= 1.5.0
aws --version
docker --version
gh --version
```

> Docker is only needed if you ever want to build images **locally**. In the normal
> flow, GitHub Actions builds them in the cloud — you don't need Docker for that.

### 1.2 An AWS account + credentials

You need an IAM user (or SSO profile) with enough permissions to create VPC, RDS,
ECS, IAM, ALB, ECR, Secrets Manager, Route 53, S3, DynamoDB. For a take-home,
an admin-level user is fine (the *app's* roles are least-privilege — that's what
gets graded, not your personal bootstrap creds).

```bash
aws configure          # paste Access Key, Secret, default region us-east-1
aws sts get-caller-identity     # must print your account id — this is your proof creds work
```

Note your **12-digit account id** from that last command — you'll use it in a
minute for the state bucket name.

### 1.3 An Anthropic API key

The app calls Claude. Have an `sk-ant-...` key ready (from the Anthropic Console).
It goes into Secrets Manager in step 4 — never into a file in this repo.

### 1.4 (Optional) A domain name

Needed **only** for real HTTPS with a valid certificate (rubric #1). Without it,
the app still fully deploys and runs over `http://<alb-dns-name>`. You can add the
domain later without rebuilding anything. See step 7.

---

## 2. Create the GitHub repo and push the code

The AWS deploy role's trust policy is **pinned to your exact GitHub repo**
(`owner/name`), so the repo has to exist *before* Terraform runs. Create it first.

**With `gh`:**

```bash
cd /Users/nimatullahrazmjo/workstation/ai-clinical-scribe

# create a private repo and push current branch
gh repo create ai-clinical-scribe --private --source=. --remote=origin --push
```

**Or with the web UI:** create an empty repo at github.com, then:

```bash
git remote add origin git@github.com:<your-username>/ai-clinical-scribe.git
git push -u origin main
```

Write down the `owner/name` (e.g. `nimat/ai-clinical-scribe`) — that's the
`github_repo` value in the next step.

> **Before pushing, sanity-check no secrets are staged.** The root `.gitignore`
> already excludes `*.tfstate`, `.terraform/`, `*.tfvars`, and `.env`. Confirm:
> ```bash
> git status --ignored | grep -E 'tfstate|tfvars|\.env' || echo "clean"
> git grep -nE 'sk-ant-|password|SECRET' -- . ':!*.md' ':!*.example'   # eyeball the hits
> ```

---

## 3. Bootstrap Terraform remote state (one time)

Terraform stores its state (which includes secret ARNs and sensitive attributes)
in an **S3 bucket with a DynamoDB lock** — never in git. That bucket has to exist
before `terraform init`, so create it out of band.

### 3.1 Create the bucket + lock table

Pick a **globally unique** bucket name. Convention here: `acs-tfstate-<account-id>`.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=us-east-1
BUCKET="acs-tfstate-${ACCOUNT_ID}"

# S3 bucket (versioned, encrypted, private)
aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
aws s3api put-bucket-versioning --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# DynamoDB lock table (name must be exactly acs-tflock — backend.tf references it)
aws dynamodb create-table --table-name acs-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region "$REGION"

echo "State bucket: $BUCKET"
```

> **Note the `us-east-1` special case:** the `create-bucket` command above is
> correct for `us-east-1` only. In any other region you must add
> `--create-bucket-configuration LocationConstraint=<region>`.

### 3.2 Point the backend at your bucket

Edit [`infra/envs/prod/backend.tf`](../infra/envs/prod/backend.tf) and replace the
placeholder bucket name with the one you just created:

```hcl
terraform {
  backend "s3" {
    bucket         = "acs-tfstate-123456789012"   # ← your real bucket name
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "acs-tflock"
    encrypt        = true
  }
}
```

---

## 4. Configure and apply the infrastructure

### 4.1 Create your `terraform.tfvars`

Copy the committed template and edit it. This file holds **non-secret** config
only and is git-ignored.

```bash
cd infra/envs/prod
cp terraform.tfvars.example terraform.tfvars
```

**Recommended starter values for a first, cheap, fast bring-up** — edit
`terraform.tfvars` to this (turn hardening ON later, step 8):

```hcl
region   = "us-east-1"
name     = "acs-prod"
az_count = 2

single_nat_gateway = true

db_instance_class      = "db.t4g.small"
db_multi_az            = false   # single-AZ is cheaper; flip to true later
db_deletion_protection = false
db_skip_final_snapshot = true
enable_rds_proxy       = false   # start without the proxy; simplest DB path

# CI/CD — MUST match the repo you created in step 2
github_repo                 = "your-username/ai-clinical-scribe"
create_github_oidc_provider = true   # false ONLY if this AWS account already has the GitHub OIDC provider

# DNS / TLS — leave blank for now → app runs on http://<alb-dns>. Add a domain in step 7.
domain_name        = ""
hosted_zone_name   = ""
create_hosted_zone = false

# Hardening — off for the first apply, flip on in step 8
enable_waf           = false
enable_alarms        = false
enable_vpc_endpoints = false
```

> **Does this account already have a GitHub OIDC provider?** If you've ever set up
> GitHub Actions → AWS before, you might. Check:
> ```bash
> aws iam list-open-id-connect-providers --query \
>   "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')]"
> ```
> If that returns a non-empty list, set `create_github_oidc_provider = false` to
> avoid a "provider already exists" error.

### 4.2 Init, plan, apply

```bash
terraform init      # connects to the S3 backend you configured in step 3.2
terraform plan      # read it — this is exactly what will be created
terraform apply     # type "yes"; RDS takes ~5–10 min, so the whole apply is ~10–15 min
```

If `plan`/`apply` complains about the OIDC provider already existing, flip
`create_github_oidc_provider = false` (see the note above) and re-run.

### 4.3 Capture the outputs

When apply finishes, grab everything CI needs. Keep this terminal open:

```bash
terraform output           # human-readable
terraform output -json > /tmp/tf-outputs.json   # machine-readable, used in step 5
```

You now have (among others): `alb_dns_name`, `db_endpoint`, `ecr_repository_urls`,
`github_actions_role_arn`, `aws_account_id`, `ecs_cluster_name`,
`ecs_service_name`, `task_family`, `execution_role_arn`, `task_role_arn`,
`app_secret_arns`, `app_subnet_ids`, `app_sg_id`.

At this point the AWS shell exists and the ECS service is running the placeholder
nginx (so `http://<alb_dns_name>` returns a stock nginx page — that's expected,
the real app arrives in step 6).

---

## 5. Seed the secret values (out of band)

Terraform created **empty secret containers** — `acs-prod/DATABASE_URL`,
`acs-prod/ANTHROPIC_API_KEY`, `acs-prod/JWT_SECRET`. You put the *values* in now,
by hand, so no secret ever touches code or state.

### 5.1 Build the DATABASE_URL

RDS created and manages the master credentials in its own Secrets Manager entry.
Pull them and assemble the connection string. The DB name is `clinical_scribe`
and the master user is `scribe_admin`.

```bash
cd infra/envs/prod

# RDS host:port (strip the trailing :5432 that `endpoint` includes)
DB_ENDPOINT=$(terraform output -raw db_endpoint)          # e.g. acs-prod-postgres.xxxx.us-east-1.rds.amazonaws.com:5432
DB_HOST=${DB_ENDPOINT%:*}

# master creds, straight from the RDS-managed secret (never printed to a file)
MASTER_ARN=$(terraform output -raw db_master_secret_arn)
CREDS=$(aws secretsmanager get-secret-value --secret-id "$MASTER_ARN" \
        --query SecretString --output text)
DB_USER=$(echo "$CREDS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["username"])')
DB_PASS=$(echo "$CREDS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["password"])')

# sslmode=require because the DB parameter group enforces rds.force_ssl=1
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:5432/clinical_scribe?sslmode=require"

aws secretsmanager put-secret-value --secret-id acs-prod/DATABASE_URL \
  --secret-string "$DATABASE_URL"
```

> **Why the master user here?** For the first working deploy this is the pragmatic
> path: the master role can `CREATE EXTENSION` (pgcrypto, pgvector), which the app's
> migrations need. Creating a dedicated **least-privilege `app_user`** is the
> hardening step in §8.4 — do that before you'd call this "production".

> **If you enabled RDS Proxy** (`enable_rds_proxy = true`): point `DATABASE_URL` at
> the proxy instead of RDS directly —
> `DB_HOST=$(terraform output -raw rds_proxy_endpoint)` — and keep `?sslmode=require`.

### 5.2 The other two secrets

```bash
aws secretsmanager put-secret-value --secret-id acs-prod/ANTHROPIC_API_KEY \
  --secret-string 'sk-ant-...your-real-key...'

aws secretsmanager put-secret-value --secret-id acs-prod/JWT_SECRET \
  --secret-string "$(openssl rand -hex 32)"
```

Verify all three now have a value:

```bash
for s in DATABASE_URL ANTHROPIC_API_KEY JWT_SECRET; do
  printf "%s: " "$s"
  aws secretsmanager get-secret-value --secret-id "acs-prod/$s" \
    --query 'SecretString' --output text | head -c 12; echo "…"
done
```

---

## 6. Wire GitHub Actions and do the first deploy

CI authenticates to AWS with **GitHub OIDC** (no static AWS keys stored in
GitHub). It reads everything else from repo **Variables** (not Secrets — these are
all non-sensitive ARNs/IDs).

### 6.1 Set the repo variables

Map each `terraform output` to a GitHub Actions repo **variable**. The workflow
([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)) expects these
exact names:

| GitHub variable | Value from Terraform |
|---|---|
| `AWS_REGION` | `us-east-1` |
| `AWS_ACCOUNT_ID` | `terraform output -raw aws_account_id` |
| `AWS_DEPLOY_ROLE_ARN` | `terraform output -raw github_actions_role_arn` |
| `NAME_PREFIX` | `acs-prod` |
| `ECS_CLUSTER` | `terraform output -raw ecs_cluster_name` |
| `ECS_SERVICE` | `terraform output -raw ecs_service_name` |
| `TASK_FAMILY` | `terraform output -raw task_family` |
| `EXECUTION_ROLE_ARN` | `terraform output -raw execution_role_arn` |
| `TASK_ROLE_ARN` | `terraform output -raw task_role_arn` |
| `DATABASE_URL_ARN` | from `app_secret_arns` (the `DATABASE_URL` one) |
| `ANTHROPIC_API_KEY_ARN` | from `app_secret_arns` |
| `JWT_SECRET_ARN` | from `app_secret_arns` |
| `APP_SUBNET_IDS` | `app_subnet_ids`, **comma-joined** (`subnet-a,subnet-b`) |
| `APP_SECURITY_GROUP_ID` | `terraform output -raw app_sg_id` |
| `VITE_API_URL` | leave blank (nginx proxies `/api`) |
| `RUN_DB_MIGRATIONS` | leave unset (migrations run each deploy) |

**Fast path with `gh`** (run from repo root, after `terraform output`):

```bash
cd infra/envs/prod
gh() { command gh "$@"; }   # ensure gh is on PATH

set_var() { command gh variable set "$1" --body "$2"; }

set_var AWS_REGION            "us-east-1"
set_var NAME_PREFIX           "acs-prod"
set_var AWS_ACCOUNT_ID        "$(terraform output -raw aws_account_id)"
set_var AWS_DEPLOY_ROLE_ARN   "$(terraform output -raw github_actions_role_arn)"
set_var ECS_CLUSTER           "$(terraform output -raw ecs_cluster_name)"
set_var ECS_SERVICE           "$(terraform output -raw ecs_service_name)"
set_var TASK_FAMILY           "$(terraform output -raw task_family)"
set_var EXECUTION_ROLE_ARN    "$(terraform output -raw execution_role_arn)"
set_var TASK_ROLE_ARN         "$(terraform output -raw task_role_arn)"
set_var APP_SECURITY_GROUP_ID "$(terraform output -raw app_sg_id)"
set_var APP_SUBNET_IDS        "$(terraform output -json app_subnet_ids | python3 -c 'import sys,json;print(",".join(json.load(sys.stdin)))')"

# the three secret ARNs come out of one map output
for k in DATABASE_URL ANTHROPIC_API_KEY JWT_SECRET; do
  arn=$(terraform output -json app_secret_arns | python3 -c "import sys,json;print(json.load(sys.stdin)['$k'])")
  set_var "${k}_ARN" "$arn"
done
```

> Run `command gh variable set` against the right repo — if you have multiple,
> add `--repo owner/ai-clinical-scribe` to each call, or `cd` into the repo first.

**Or via the web UI:** repo → Settings → Secrets and variables → Actions →
**Variables** tab → New repository variable, one per row above.

### 6.2 Create the `production` environment

The deploy job runs in an `environment: production`. Create it so the job isn't
blocked, and (optionally) add yourself as a required reviewer to gate deploys:

- Repo → Settings → Environments → **New environment** → name it `production`.
- (Optional) enable "Required reviewers" and add yourself.

### 6.3 Trigger the deploy

Any push to `main` that touches `backend/`, `frontend/`, `packages/`, or the task
definition triggers the pipeline. The simplest trigger:

```bash
git commit --allow-empty -m "ci: trigger first deploy"
git push origin main
```

Or run it manually: repo → Actions → **Deploy to ECS** → Run workflow.

**What the pipeline does** (watch it in the Actions tab):

1. Builds `api` (backend) and `web` (nginx + SPA) images, tags them with the
   12-char git SHA, pushes to ECR.
2. Registers a new ECS task definition from
   [`infra/deploy/ecs/task-definition.json`](../infra/deploy/ecs/task-definition.json).
3. Runs a **one-off migration task** (`node dist/migrate`, advisory-locked) and
   fails the deploy if migrations fail.
4. `update-service` → rolling deploy. The ECS **deployment circuit breaker**
   auto-rolls-back on failed health checks, which turns a bad deploy into a red
   pipeline.
5. Waits for the service to stabilize.

When it's green, open the app:

```bash
cd infra/envs/prod
open "http://$(terraform output -raw alb_dns_name)"
```

---

## 7. (Optional) Add a real domain + HTTPS

Rubric #1 wants a valid CA certificate. To switch the ALB from HTTP to HTTPS:443
with an auto-renewing ACM cert, set the domain vars and re-apply. No app rebuild.

### 7.1 If your domain's DNS is already a Route 53 hosted zone

Edit `terraform.tfvars`:

```hcl
domain_name        = "scribe.example.com"
hosted_zone_name   = "example.com"
create_hosted_zone = false
```

```bash
terraform apply
```

Terraform creates the ACM cert, DNS-validates it in your zone, attaches it to a
new HTTPS:443 listener, adds an 80→443 redirect, and points an A/ALIAS record at
the ALB. When apply finishes:

```bash
terraform output -raw app_url      # https://scribe.example.com
curl -vI "$(terraform output -raw app_url)"   # confirm a valid Amazon-issued chain
```

### 7.2 If the domain isn't in Route 53 yet

Set `create_hosted_zone = true`, `terraform apply`, then take the
`route53_name_servers` output and set those NS records at your domain registrar.
Wait for propagation, then `terraform apply` again so ACM can finish validation.

---

## 8. (Optional) Hardening — flip these on for the "production" story

Each is an independent toggle in `terraform.tfvars`; `terraform apply` after
changing any. Turn them on once the base app is proven working.

| Toggle | What it adds | Cost note |
|---|---|---|
| `db_multi_az = true` | Synchronous standby + automatic failover | ~2× the RDS hourly |
| `enable_rds_proxy = true` | Pools/multiplexes DB connections, smooths failover | ~$12–15/mo |
| `enable_waf = true` | WAFv2 on the ALB (managed rules + per-IP rate limit) | per-rule + request |
| `enable_alarms = true` (+ `alarm_email`) | CloudWatch alarms → SNS (ALB 5xx, RDS CPU/conns, ECS) | ~free at this scale |
| `enable_vpc_endpoints = true` | ECR/Secrets/Logs/SSM interface endpoints; cuts NAT traffic | hourly per endpoint |

> **If you flip `enable_rds_proxy = true`,** re-point `DATABASE_URL` at the proxy
> endpoint (§5.1 note) and re-run the app deploy (empty commit → push).

### 8.4 (Recommended) Swap the app to a least-privilege DB role

Using the master user in `DATABASE_URL` works but isn't the defensible answer. To
create a scoped `app_user`, you must reach the **private** RDS from inside the VPC.
The ECS EC2 instances have the SSM agent + permissions, so tunnel through one:

```bash
# find a running ECS container-instance's EC2 id (must have SSM registered)
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:project,Values=ai-clinical-scribe" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)

# port-forward localhost:5432 → RDS:5432 through that instance
DB_HOST=$(cd infra/envs/prod && terraform output -raw db_endpoint); DB_HOST=${DB_HOST%:*}
aws ssm start-session --target "$INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"$DB_HOST\"],\"portNumber\":[\"5432\"],\"localPortNumber\":[\"5432\"]}"
```

In a second terminal, connect as master (creds from §5.1) via `localhost:5432` and:

```sql
CREATE ROLE app_user LOGIN PASSWORD '<generate-one>';
GRANT CONNECT ON DATABASE clinical_scribe TO app_user;
GRANT USAGE, CREATE ON SCHEMA public TO app_user;
-- extensions need elevated rights, so create them as master up front:
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
```

Then rewrite `acs-prod/DATABASE_URL` (§5.1) using `app_user` instead of the master,
and redeploy.

---

## 9. Day-2 operations

### Deploy a change
Just push to `main`. CI does the rest.

### Roll back
Repo → Actions → **Rollback ECS deployment** → Run workflow.
- Leave `image_tag` **blank** → reverts to the previous task-definition revision
  (fastest undo).
- Set `image_tag` to a past git SHA → pins that exact image (within the ECR
  retention horizon of 30 images).

> Migrations are **not** rolled back by this — keep every migration
> backward-compatible (expand/contract) so an image rollback stays safe.

### Read logs
CloudWatch log groups: `/acs/prod/api`, `/acs/prod/web`. The migration task logs
under `/acs/prod/api` with stream prefix `migrate`.

```bash
aws logs tail /acs/prod/api --follow
```

### Prove the rubric points live
Runbooks under `infra/.claude/commands/` (`sg-audit`, `tls-verify`,
`deploy-checklist`, `rotate-secret`, `cost-estimate`) are the walkthrough scripts.

---

## 10. Teardown (avoid surprise bills)

```bash
cd infra/envs/prod

# if you set deletion protection on RDS, turn it off first:
#   set db_deletion_protection = false in tfvars, then `terraform apply`, then:
terraform destroy      # type "yes"

# state bucket + lock table are outside Terraform — delete last if you're fully done:
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3 rb "s3://acs-tfstate-${ACCOUNT_ID}" --force
aws dynamodb delete-table --table-name acs-tflock
```

Everything is tagged `project=ai-clinical-scribe`, so you can also sweep for
stragglers:

```bash
aws resourcegroupstaggingapi get-resources \
  --tag-filters Key=project,Values=ai-clinical-scribe \
  --query 'ResourceTagMappingList[].ResourceARN'
```

---

## 11. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `terraform init` fails on backend | Bucket name in `backend.tf` doesn't match the one you created, or the DynamoDB table isn't named `acs-tflock`. |
| Apply error: OIDC provider already exists | Set `create_github_oidc_provider = false` in tfvars. |
| CI "not authorized to perform sts:AssumeRoleWithWebIdentity" | `github_repo` in tfvars ≠ your real `owner/name`, or `AWS_DEPLOY_ROLE_ARN` variable is wrong. Fix and re-apply / re-set the var. |
| Migration task exits non-zero | Bad `DATABASE_URL` (wrong host/creds/`sslmode`), or app_user lacks rights to `CREATE EXTENSION`. Check `/acs/prod/api` logs, stream prefix `migrate`. |
| App loads but `/api` calls fail | Secret values not seeded (§5), or `DATABASE_URL` points at the wrong endpoint (RDS vs proxy). |
| ECS service never stabilizes / circuit breaker rolls back | Container failing health checks — read `/acs/prod/api` and `/acs/prod/web` logs. |
| `psql` from your laptop to RDS times out | **Correct** — RDS is private (rubric #7). Reach it only via the SSM tunnel in §8.4. |
| HTTPS not working after setting domain | Zone not delegated (registrar NS ≠ `route53_name_servers`), or cert still validating — wait, then `terraform apply` again. |

---

## Appendix — one-page quick reference

```bash
# 3. state bootstrap (once)
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3api create-bucket --bucket "acs-tfstate-$ACCOUNT_ID" --region us-east-1
# ...versioning/encryption/pab + dynamodb table acs-tflock (see §3.1)
# edit infra/envs/prod/backend.tf → bucket = "acs-tfstate-$ACCOUNT_ID"

# 4. infra
cd infra/envs/prod
cp terraform.tfvars.example terraform.tfvars   # set github_repo + starter values
terraform init && terraform apply

# 5. secrets
aws secretsmanager put-secret-value --secret-id acs-prod/DATABASE_URL      --secret-string "$DATABASE_URL"
aws secretsmanager put-secret-value --secret-id acs-prod/ANTHROPIC_API_KEY --secret-string 'sk-ant-...'
aws secretsmanager put-secret-value --secret-id acs-prod/JWT_SECRET        --secret-string "$(openssl rand -hex 32)"

# 6. wire GitHub vars (see §6.1 gh script) → create `production` env → push
git commit --allow-empty -m "ci: trigger first deploy" && git push origin main

# verify
open "http://$(terraform output -raw alb_dns_name)"
```
