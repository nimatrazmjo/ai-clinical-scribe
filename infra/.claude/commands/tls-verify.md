---
description: Verify the TLS certificate chain is valid, CA-issued, and not self-signed
argument-hint: <domain>
---
Run the following checks against `$1` and report PASS / FAIL for each:

1. **Chain validity** — `openssl s_client -connect $1:443 -showcerts` — confirm the chain ends at a
   known public CA (not a self-signed root).
2. **Expiry** — cert must have > 14 days remaining. Print the exact expiry date.
3. **Subject match** — the cert's CN or SAN must match `$1`. Wildcard is acceptable if it covers the
   subdomain.
4. **Protocol** — TLS 1.2+ only. Confirm TLS 1.0 and 1.1 are not negotiated.
5. **Cipher** — no RC4, DES, or NULL cipher suites in the server's offered list.
6. **HSTS** — the response headers must include `Strict-Transport-Security` with `max-age >= 31536000`.
7. **ACM vs certbot** — note which CA issued it (ACM = Amazon, Let's Encrypt = certbot) and confirm
   the renewal mechanism: ACM auto-renews if the ALB is attached; certbot requires a cron job on EC2.

If any check fails, this is a grading blocker — fix before submission.
