---
description: Rotate a secret in Secrets Manager and confirm the app picks it up
argument-hint: <secret-name>
---
Rotate `$1` in AWS Secrets Manager. Confirm the app's `AwsSecretsLoader` re-reads it on next boot
without requiring a code change or a hardcoded fallback.
