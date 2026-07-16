---
description: Audit EC2 SSH configuration and key management
---
Review the EC2 security group rules and the deployed SSH configuration. Report PASS / FAIL:

1. **SSH port exposure** — port 22 must NOT be open to `0.0.0.0/0`. Acceptable: scoped to a known
   IP range or accessed via AWS Systems Manager Session Manager (no port 22 needed at all).
2. **Key pair** — the EC2 key pair name is in Terraform; confirm the private key is NOT committed
   to the repo in any form (`.pem`, base64, etc.).
3. **Root login** — if you can SSH in, confirm `PermitRootLogin no` in `/etc/ssh/sshd_config`.
4. **Password auth** — `PasswordAuthentication no` in sshd_config. Key-only auth.
5. **SSM alternative** — if using AWS Systems Manager Session Manager instead of SSH, confirm the
   EC2 IAM role has `AmazonSSMManagedInstanceCore` policy and the `ssm-agent` is running.
6. **Known hosts** — the deploy script must not use `-o StrictHostKeyChecking=no` in production;
   flag if it does.

Preferred posture: no port 22 open at all, use SSM Session Manager. Flag if SSH is the only access
path and suggest SSM as an upgrade.
