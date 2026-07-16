---
description: Frontend security review — XSS, secrets, CSP, auth boundaries
---
Review `git diff` for these issues and report each as PASS / FAIL / N/A:

1. **XSS** — any use of `dangerouslySetInnerHTML`, `innerHTML`, or `eval()`. Clinical note content
   rendered as text only, never as HTML.
2. **Secrets in source** — no API key, Anthropic key, or DB credential referenced in any `.ts`,
   `.tsx`, `.env.*` file that ships in the bundle. `VITE_*` vars are bundled — confirm none are
   secrets.
3. **JWT storage** — token stored in memory or `sessionStorage`, not `localStorage` (XSS
   accessible). Confirm token is not logged to the console.
4. **Auth boundary** — RBAC-gated UI elements (`admin` shell) hidden from `provider` tokens, but
   confirm the backend enforces those routes too — the frontend check is UX only.
5. **Open redirects** — any redirect after login reads a `?next=` param. Confirm it validates to a
   same-origin path, not an arbitrary URL.
6. **Dependency CVEs** — run `pnpm audit --audit-level=high` and flag any high/critical findings.
7. **Content-Security-Policy** — confirm `vite.config.ts` or nginx sets a `Content-Security-Policy`
   header that disallows `unsafe-inline` scripts.
8. **Stream abort** — every `fetch` stream has an `AbortController` wired on unmount. No orphaned
   streams that could deliver tokens after a patient switch.
