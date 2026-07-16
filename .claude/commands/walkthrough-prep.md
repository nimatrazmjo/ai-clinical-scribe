---
description: Pre-walkthrough readiness check — validate every rubric point before the call
---
Run through every graded criterion and report PASS / FAIL with evidence (command output or file ref):

## Core scribe workflow
- [ ] POST transcript → SSE stream opens, tokens arrive for each SOAP section in order (S→O→A→P).
- [ ] ICD-10 codes arrive in the `icd_codes` SSE event before `done`.
- [ ] Empty transcript → `NON_CLINICAL_TRANSCRIPT` error event, no LLM call made.
- [ ] Non-clinical transcript (e.g., "hello world") → same guardrail fires, no fabricated note.

## Streaming quality
- [ ] Client uses `fetch()` + `ReadableStream`, confirmed in `useSoapStream` source.
- [ ] `AbortController` present and wired to unmount + explicit Cancel button.
- [ ] No second stream can race the first (second generate call aborts the first).

## Database design
- [ ] `note_versions` has `UNIQUE(encounter_id, version_no)` constraint in migration.
- [ ] No UPDATE/DELETE migration or repository method exists for `note_versions`.
- [ ] Page refresh mid-encounter restores draft from server (not localStorage).

## Auth + session edge cases
- [ ] Expired JWT → API returns 401. Frontend catches and shows session-expired state.
- [ ] Save attempt on expired token: note content is preserved in local state, not lost.

## Infra rubric (confirm live or from Terraform output)
- [ ] HTTPS: CA-issued cert (not self-signed). TLS 1.2+ only.
- [ ] nginx in front of app. Node process on port 3000, not 80/443.
- [ ] RDS not publicly accessible. `publicly_accessible = false` in Terraform.
- [ ] All secrets in Secrets Manager. Zero credentials in code or `.env` committed.
- [ ] Connection pool configured (`max: 10` in DataSource, matches RDS `max_connections`).

## Walkthrough answers (have these ready)
- One sentence on why encounter and scribe are full-hexagonal, others are flat.
- One sentence on why history injection is a server-side tool call, not frontend prompt assembly.
- One sentence on why `fetch` + `ReadableStream` instead of `EventSource`.
- One sentence on why `note_versions` is append-only and how the DB enforces it.
- One sentence on the CORS and HTTPS posture.
