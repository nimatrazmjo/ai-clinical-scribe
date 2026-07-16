---
description: OWASP + clinical-data security review of the pending diff
---
Review `git diff` for these issues and report each as PASS / FAIL / N/A:

1. **Injection** — any raw SQL, unsanitized `query()` call, or TypeORM `QueryBuilder` with user input concatenated instead of parameterized.
2. **Auth bypass** — any route missing `JwtAuthGuard`, any ownership check that relies only on a role guard instead of a `WHERE provider_id = :callerId` filter.
3. **Secrets in code** — any hardcoded credential, inline `process.env.DB_PASSWORD`, or `.env` value committed directly. Secrets must go through `AwsSecretsLoader`.
4. **PHI logging** — any `console.log`, `logger.log`, or exception message that could print note content, patient names, or transcript text.
5. **Password storage** — any password stored or compared without argon2/bcrypt. No plaintext, no MD5/SHA1.
6. **Token safety** — JWT secret read from Secrets Manager, not hardcoded. Refresh-token rotation in place if refresh tokens are issued.
7. **Mass assignment** — any DTO missing `class-validator` decorators that would allow a client to set `role`, `providerId`, or `versionNo` directly.
8. **note_versions integrity** — no UPDATE or DELETE path touching `note_versions`. Append-only must be enforced at the repository level.
9. **CORS** — CORS origin is an explicit allowlist, not `*`, in production config.
10. **Dependency CVEs** — run `pnpm audit --audit-level=high` and flag any high/critical findings.
