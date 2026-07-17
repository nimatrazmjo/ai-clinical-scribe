# Software Requirements Specification

## AI Clinical Scribe Platform — Kyron Medical Technical Challenge

**Version:** 0.2 (reprioritized) · **Author:** Nimat Razmjo · **Date:** 2026-07-16
**Target submission:** 2026-07-18, 15:00 EST

Structured to ISO/IEC/IEEE 29148 (successor to IEEE 830), with Agile user-story and
Given/When/Then acceptance criteria, MoSCoW priority, and AI-native extensions (versioned prompt
specs, eval-driven acceptance, guardrails-as-requirements). Requirement IDs are traceable to the
evaluation rubric in §10.

**v0.2 changes from the original draft:** prioritization was revisited after initial drafting —
see §10 for the current tiering. Patient history injection (HIST) was promoted to near-Must,
cross-device session persistence (SESS) was downgraded to Could, template live-propagation was
reframed as low-risk (a live DB read at generation time, not a push mechanism), and the two edge
cases plus the #1 pioneer feature were locked rather than left open.

---

## 1. Introduction

### 1.1 Purpose

Define the complete requirements for a provider-facing AI clinical documentation platform that
transforms raw encounter transcripts or freeform observations into structured SOAP notes with
suggested ICD-10 codes. This SRS is the source of truth for design, build, test, and the
code-review walkthrough.

### 1.2 Product scope

A multi-role web application (Provider, Admin) that: authenticates users; lets providers create
patient encounters and stream AI-generated SOAP notes; injects prior patient history via backend
tool-calls; versions every note immutably; offers semantic ICD-10 search; gives admins roster and
template control with live propagation; persists in-progress drafts; and runs on hardened AWS
infrastructure (EC2 behind nginx, RDS in a private VPC, secrets in Secrets Manager).

### 1.3 Definitions & acronyms

**SOAP** — Subjective, Objective, Assessment, Plan (clinical note structure). **ICD-10** —
International Classification of Diseases, 10th revision (diagnosis codes). **SSE** —
Server-Sent Events. **RBAC** — Role-Based Access Control. **PHI** — Protected Health Information.
**RDS/VPC** — AWS Relational Database Service / Virtual Private Cloud. **Eval** — automated
quality test of AI output against expected behavior. **Golden set** — curated input/expected-output
pairs for regression-testing AI. **Guardrail** — a constraint that blocks or reshapes unsafe/invalid
AI output.

### 1.4 Stakeholders & actors

**Primary actors:** Provider (physician/clinical staff — creates and edits notes), Admin (manages
roster and templates, oversees all encounters). **Evaluator** (Kyron reviewer — judges via live
app plus walkthrough video). **System actors:** LLM inference API, embeddings model, AWS managed
services.

### 1.5 Constraints & assumptions

Hard deadline (~48h). Solo build. The rubric explicitly weights core scribe workflow, streaming,
RDS persistence, and infrastructure as must-be-airtight; everything else is "prioritize
intelligently." Assumes access to a commercial LLM API with streaming and tool-calling and an
embeddings endpoint. Demo accounts are hard-coded seed data. No real PHI is used; design is
HIPAA-_aligned_ to demonstrate judgment, not certified.

---

## 2. Overall Description

### 2.1 System context

Browser (React SPA) → HTTPS → nginx reverse proxy on EC2 → NestJS application (stateless, pooled)
→ AWS RDS PostgreSQL (private subnet). NestJS calls the LLM/embeddings APIs server-side and
streams tokens back to the browser over SSE. Secrets resolved at boot from AWS Secrets Manager.
No component except nginx is internet-exposed; RDS accepts connections only from the app security
group inside the VPC.

### 2.2 User classes

**Provider** — authenticated clinician; scoped to _own_ encounters only; primary workflow user;
values speed, trust, and editability. **Admin** — superuser; sees all encounters, manages
providers and templates; values oversight and control. Providers cannot access admin surfaces;
admins are not required to author notes.

### 2.3 Operating environment

AWS EC2 (Linux) + nginx + Node/NestJS; AWS RDS PostgreSQL; modern evergreen browser. HTTPS with a
CA-issued certificate (no self-signed).

### 2.4 Design & implementation constraints (mandated by the challenge)

- **C-1** All persistent state in AWS RDS (PostgreSQL). No SQLite, flat files, or in-memory stores
  for durable data. _(Must)_
- **C-2** DB connection pooling; no per-request connections. _(Must)_
- **C-3** Secrets in AWS Secrets Manager or Parameter Store; zero hardcoded credentials, including
  committed `.env`. _(Must)_
- **C-4** nginx reverse proxy in front; app process not directly bound to 80/443. _(Must)_
- **C-5** RDS not publicly accessible; VPC-only ingress from app security group. _(Must)_
- **C-6** Normalized, defensible schema; ERD walkable on video. _(Must)_
- **C-7** HTTPS with valid CA cert. _(Must)_

### 2.5 Dependencies

LLM inference API (streaming + tool/function calling), embeddings API (ICD-10 and optional history
semantic search), AWS (EC2, RDS, Secrets Manager, VPC/security groups, ACM or Let's Encrypt for
TLS).

---

## 3. Functional Requirements

Format per epic: **User story** → **Acceptance criteria (Given/When/Then)** → **Priority**.
Priorities reflect the challenge's own weighting, revised per §10.

### 3.1 Epic AUTH — Authentication & Multi-Role Access

**Story:** As a user, I authenticate and receive a role so the system shows only what I'm
authorized to see.

- **FR-AUTH-01 (Must):** System supports two roles, Provider and Admin, with distinct
  authorization scopes.
- **FR-AUTH-02 (Must):** ≥3 provider accounts and 1 admin account are seeded for demo.
- **FR-AUTH-03 (Must):** Login issues a signed token (JWT or server session). _Given_ valid
  credentials, _when_ a user logs in, _then_ a token encoding user id + role is returned and
  required on all protected endpoints.
- **FR-AUTH-04 (Must):** RBAC enforced server-side. _Given_ a provider token, _when_ it requests
  another provider's encounter or any admin route, _then_ the API returns 403 — enforcement is not
  client-side only.
- **FR-AUTH-05 (Must):** Passwords stored hashed (bcrypt/argon2), never plaintext.
- **FR-AUTH-06 (Should):** Token expiry + refresh (or sliding session); expiry drives edge-case
  FR-EDGE-02.
- **FR-AUTH-07 (Must):** Every architectural layer of auth is explainable on walkthrough (token
  issuance, verification middleware/guard, RBAC guard, scoping in queries).

### 3.2 Epic ENC — Encounter Workspace (Provider)

**Story:** As a provider, I create an encounter and capture input so I can generate a note.

- **FR-ENC-01 (Must):** Provider starts an encounter by entering patient first name, last name,
  DOB.
- **FR-ENC-02 (Must):** Provider pastes a raw transcript or types freeform observations into a
  text area.
- **FR-ENC-03 (Must):** Provider selects a note template before generating (default template if
  none chosen). _(links FR-TMPL)_
- **FR-ENC-04 (Must):** Provider edits the generated note inline before saving.
- **FR-ENC-05 (Must):** Provider saves the finalized note; save persists to RDS and creates a
  version _(links FR-VER)_.
- **FR-ENC-06 (Must):** Provider sees only their own encounters in any list/history view.

### 3.3 Epic GEN — AI SOAP Generation & Streaming

**Story:** As a provider, I click Generate and watch a structured note stream in so it feels
immediate and trustworthy.

- **FR-GEN-01 (Must):** "Generate Note" triggers server-side LLM generation; tokens stream to the
  client via SSE (or WebSocket) with progressive rendering — no full-page reload, no
  spinner-then-dump. _Given_ a submitted transcript, _when_ generation starts, _then_ content
  begins rendering within a low latency budget (NFR-PERF-01) and fills incrementally.
- **FR-GEN-02 (Must):** Output contains all four SOAP sections: Subjective, Objective, Assessment,
  Plan.
- **FR-GEN-03 (Must):** Assessment includes ≥1 ICD-10 code + description semantically matched to
  the clinical content.
- **FR-GEN-04 (Must):** Output conforms to a defined structured schema so the UI can render
  sections reliably _(links AI-FR-04)_.
- **FR-GEN-05 (Should):** Stream is cancelable; partial output is discardable without corrupting
  state.
- **FR-GEN-06 (Must):** Generation behavior visibly changes with the active template
  _(links FR-TMPL-04)_ and with patient history _(links FR-HIST-03)_.

### 3.4 Epic HIST — Patient History & Context Injection

**Story:** As a provider seeing a returning patient, I want the AI to know their prior encounters
so the note reflects continuity of care.

- **FR-HIST-01 (Must):** On encounter start, system matches patient by (first name, last name,
  DOB) against saved notes.
- **FR-HIST-02 (Must):** For a matched (returning) patient, prior encounter history is retrieved
  and injected as generation context **via a backend tool/function call during generation** — not
  by stuffing prior notes into the frontend prompt.
- **FR-HIST-03 (Must):** AI demonstrably behaves differently for returning vs. first-time
  patients, referencing relevant prior diagnoses/treatments where clinically appropriate.
  _(Must be demoable on video.)_
- **FR-HIST-04 (Should):** History retrieval is relevance-ranked (recency and/or semantic
  similarity) rather than dumping all prior notes.

> **Priority note (v0.2):** HIST was promoted to near-Must despite being outside the rubric's
> literal "core" list — it is the single highest signal-per-hour requirement outside the core
> loop, and the most likely thing a reviewer probes on the walkthrough.

### 3.5 Epic VER — Note Versioning & Audit Trail

**Story:** As a provider/admin, I need an immutable version history so clinical records are
auditable.

- **FR-VER-01 (Must):** Every edit-and-resave writes a **new** version row; prior versions are
  never overwritten or deleted (append-only).
- **FR-VER-02 (Must):** Each version records who saved it and when.
- **FR-VER-03 (Must):** Providers can view full version history of a note.
- **FR-VER-04 (Must):** Version history is stored in and retrieved from AWS RDS (not
  memory/flat file).
- **FR-VER-05 (Should):** A general audit log captures security-relevant actions (login, save,
  template change, deactivation).

### 3.6 Epic ICD — ICD-10 Semantic Search Widget

**Story:** As a provider, I search ICD-10 codes in plain English and attach them to the note.

- **FR-ICD-01 (Should):** Standalone search widget inside the encounter workspace accepts
  plain-English symptom/condition input.
- **FR-ICD-02 (Should):** Returns top semantically relevant ICD-10 codes via vector similarity or
  an AI call.
- **FR-ICD-03 (Should):** Clicking a result appends it to the Assessment section of the open note.
- **FR-ICD-04 (Must):** A local subset of **≥200–300** ICD-10 entries powers this; no external
  ICD-10 API.
- **FR-ICD-05 (Should):** Embeddings for the local set are precomputed and stored (e.g., pgvector)
  for fast similarity search.

### 3.7 Epic ADMIN — Admin Dashboard

**Story:** As an admin, I oversee all encounters and manage the provider roster.

- **FR-ADMIN-01 (Should):** Admin views all encounters across providers, filterable by provider
  and date range.
- **FR-ADMIN-02 (Should):** Admin adds new provider accounts.
- **FR-ADMIN-03 (Should):** Admin deactivates provider accounts; deactivated providers cannot
  authenticate _(links FR-EDGE-03)_.
- **FR-ADMIN-04 (Must):** Admin surfaces are inaccessible to providers (RBAC).

### 3.8 Epic TMPL — Note Template Management & Live Propagation

**Story:** As an admin, I manage prompt templates that shape AI output per encounter type; changes
take effect immediately.

- **FR-TMPL-01 (Should):** Admin creates, edits, deletes templates (structured prompts, e.g.,
  orthopedic follow-up vs. new-patient eval vs. urgent care).
- **FR-TMPL-02 (Should):** Providers select an active template before generating.
- **FR-TMPL-03 (Must, if TMPL built):** Template changes take effect immediately — _given_ a
  provider has the workspace open, _when_ an admin updates the active template, _then_ the
  provider's next generation uses the new template **without a page refresh** (implemented by
  reading the current template from RDS at generation time — a live read, not a push mechanism;
  this makes the requirement low-risk rather than a WebSocket-push problem).
- **FR-TMPL-04 (Should):** AI output visibly differs by active template. _(Demoable.)_

### 3.9 Epic SESS — Session Persistence (Draft Restore)

**Story:** As a provider interrupted mid-encounter, I resume exactly where I left off.

- **FR-SESS-01 (Should):** In-progress draft (patient + transcript + unsaved note) is persisted to
  RDS as the provider works (debounced autosave).
- **FR-SESS-02 (Should):** _Given_ an unsaved draft, _when_ the provider refreshes or reopens the
  browser (same device), _then_ the draft is restored from RDS.
- **FR-SESS-03 (Could — downgraded in v0.2):** _Given_ the same provider logs in from a different
  browser/device, _when_ they open the workspace, _then_ the same draft state is restored.
  Full cross-device restore is real-effort, low-visibility work; ship single-device restore
  (FR-SESS-02) first and treat cross-device as a stretch item only if ahead of schedule.

### 3.10 Epic EDGE — Non-Happy-Path Scenarios (locked, 2 of 2)

**Story:** As a provider/admin, the system degrades gracefully under failure conditions without
data loss or hallucination.

- **FR-EDGE-01 (Must — locked scenario #1):** _Clinically empty input._ _Given_ a transcript with
  no clinically meaningful content, _when_ Generate is clicked, _then_ the system responds
  gracefully (prompts for more info / declines) rather than hallucinating a fabricated SOAP note.
  _(links AI-SAFE-02)_
- **FR-EDGE-02 (Must — locked scenario #2):** _Expired session on save._ _Given_ an expired token,
  _when_ the provider saves, _then_ the system prevents data loss (preserves draft, re-auths,
  completes save).
- **FR-EDGE-03 (Could — not selected, but defined for reference):** _Provider deactivated
  mid-draft._ If time allows a third scenario, define a graceful lockout after the current draft
  is safely persisted.
- **FR-EDGE-04 (Must):** The two locked scenarios are substantive and clearly demonstrated in the
  walkthrough.

---

## 4. AI / Model Requirements

- **AI-FR-01 Model selection (Must):** Choose an LLM with native streaming, tool/function calling,
  and reliable structured output; document the rationale (quality vs. latency vs. cost) for the
  walkthrough.
- **AI-FR-02 Prompt/template spec (Must):** System prompt and note templates are versioned, stored
  artifacts (templates in RDS). Each template defines role, SOAP structure, tone, and
  encounter-type-specific guidance.
- **AI-FR-03 Tool-calling contract (Must):** Define the `get_patient_history(patient_id)` (and
  optional `search_icd10`) tool schema the model invokes during generation; history is fetched
  server-side and returned to the model _(implements FR-HIST-02)_.
- **AI-FR-04 Structured output schema (Must):** Generation returns a typed schema (`subjective`,
  `objective`, `assessment{ text, icd10[] }`, `plan`) so the UI renders deterministically and codes
  are machine-extractable _(implements FR-GEN-04)_.
- **AI-FR-05 Streaming contract (Must):** Define the token/section streaming protocol over SSE
  (event types: token, section boundary, tool-call, done, error) so the client renders
  progressively and handles interruptions.
- **AI-FR-06 Determinism controls (Should):** Temperature and max-tokens tuned for clinical
  consistency; documented.
- **AI-FR-07 Eval-driven acceptance (Should):** A small golden set (returning vs. new patient,
  empty input, each template) validates well-formed output, section presence, ICD-10 relevance,
  and history/template behavior differences.
- **AI-FR-08 AI observability (Could):** Log latency, token usage, tool-call success, and
  refusal/guardrail-trigger rates.

---

## 5. Clinical AI Safety Requirements

- **AI-SAFE-01 (Must):** No fabrication — the model must not invent clinical facts (vitals, labs,
  meds) absent from the transcript/history; prompts explicitly instruct grounding in provided
  input.
- **AI-SAFE-02 (Must):** Empty/irrelevant-input guardrail — detect non-clinical input and decline
  gracefully _(implements FR-EDGE-01)_.
- **AI-SAFE-03 (Should):** ICD-10 suggestions are framed as _suggested_ and require provider
  confirmation; provider always edits before save (human-in-the-loop).
- **AI-SAFE-04 (Could — pioneer #2):** Clinical red-flag detection — scan transcript for critical
  signals (e.g., chest pain + dyspnea) and surface a flag before generation.
- **AI-SAFE-05 (Must):** Immutable audit trail of clinical content _(implements FR-VER)_ supports
  accountability.
- **AI-SAFE-06 (Must):** PHI handling — treat patient data as PHI: TLS in transit, encryption at
  rest (RDS), least-privilege access, no PHI in client-side prompts or logs, no third-party
  training on PHI. HIPAA-_aligned_ demonstration.
- **AI-SAFE-07 (Should):** Output disclaimer/state that notes are AI-assisted drafts pending
  clinician review.

---

## 6. Non-Functional Requirements

**Performance**

- **NFR-PERF-01 (Must):** Time-to-first-token perceptibly fast (target < ~1.5s); streaming renders
  continuously thereafter.
- **NFR-PERF-02 (Should):** ICD-10 search returns < ~500ms for the local set.

**Scalability & reliability**

- **NFR-SCALE-01 (Must):** Stateless app tier + RDS connection pool _(implements C-1/C-2)_; pool
  sized to instance/RDS limits.
- **NFR-REL-01 (Should):** Graceful handling of LLM API errors/timeouts (retry/backoff,
  user-facing error, no partial corrupt saves).

**Security**

- **NFR-SEC-01 (Must):** HTTPS/TLS everywhere, valid CA cert _(C-7)_.
- **NFR-SEC-02 (Must):** Secrets via Secrets Manager/Parameter Store _(C-3)_.
- **NFR-SEC-03 (Must):** RDS private, VPC-only ingress from app SG _(C-5)_.
- **NFR-SEC-04 (Must):** nginx reverse proxy; app not directly exposed _(C-4)_.
- **NFR-SEC-05 (Must):** Server-side RBAC + query-level scoping; input validation on all
  endpoints.

**Usability**

- **NFR-UX-01 (Must):** Clinical-grade UI — clean, dense, high-trust; not consumer-bubbly. Legible
  typography, clear SOAP structure, keyboard-friendly.

**Maintainability & observability**

- **NFR-OBS-01 (Should):** Structured logging + basic health checks; no secrets/PHI in logs.
- **NFR-MAINT-01 (Should):** Typed end-to-end (shared TS types), modular NestJS architecture.

---

## 7. Data Requirements

Core entities and relationships (3NF; physical schema finalized in Design):

| Entity               | Key fields                                                                                                                                                 | Notes                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `users`              | id, role(enum), first/last, email, password_hash, is_active, created_at                                                                                    | Providers + admins; `is_active` drives deactivation |
| `patients`           | id, first_name, last_name, dob, match_key(unique)                                                                                                          | Match key = normalized (name+dob) for FR-HIST-01    |
| `encounters`         | id, patient_id→patients, provider_id→users, template_id→templates, status(draft/finalized), current_transcript, working_draft_json, created_at, updated_at | Draft state lives here for FR-SESS                  |
| `note_versions`      | id, encounter_id→encounters, version_no, subjective, objective, assessment, plan, saved_by→users, created_at                                               | **Append-only**; immutable (FR-VER)                 |
| `note_version_icd10` | note_version_id→note_versions, icd10_code→icd10_codes                                                                                                      | M:N; codes per version                              |
| `icd10_codes`        | code(pk), description, embedding(vector)                                                                                                                   | Reference data, ≥200–300 rows, pgvector             |
| `templates`          | id, name, type, prompt_body, is_active, created_by→users, updated_at                                                                                       | Live-read at generation (FR-TMPL-03)                |
| `audit_log`          | id, actor_id→users, action, entity_type, entity_id, metadata, created_at                                                                                   | Security/audit events                               |

Relationships: users 1—M encounters; patients 1—M encounters; encounters 1—M note_versions;
note_versions M—N icd10_codes; templates 1—M encounters; users 1—M audit_log.

- **DR-01 (Must):** `note_versions` is append-only; enforce no UPDATE/DELETE of clinical content.
- **DR-02 (Must):** Unique constraint on patient match key; index encounters by (provider_id),
  (patient_id); index note_versions by (encounter_id, version_no).
- **DR-03 (Must):** All PHI-bearing tables encrypted at rest (RDS).

---

## 8. External Interface Requirements

- **EIR-01 UI:** React SPA; SSE client for streaming; responsive, clinical aesthetic.
- **EIR-02 API:** REST (NestJS) for CRUD; SSE/WS endpoint for generation.
- **EIR-03 LLM/embeddings:** Server-side calls only; keys from Secrets Manager.
- **EIR-04 AWS:** EC2, RDS, Secrets Manager, VPC/SGs, ACM/Let's Encrypt.
- **EIR-05 Comms:** HTTPS only; SSE for token stream; WSS if WebSockets chosen.

---

## 9. AI-Augmented SDLC Process

Applying AI across the lifecycle, matching a phased/diff-review workflow:

- **Requirements:** AI-assisted elicitation, captured in this SRS.
- **Design:** AI-generated architecture/ERD drafts, reviewed and hardened by the engineer.
- **Build:** slice-by-slice / phased prompting per epic (auth → encounter → streaming →
  persistence → admin), diff-review every change before commit, never merge unread AI output.
- **Test:** AI-generated unit/integration tests plus the eval golden set (AI-FR-07); LLM-as-judge
  for note quality.
- **Review:** AI diff review pass per slice; security self-review of auth and infra.
- **Deploy:** AI-assisted IaC/nginx/systemd config, human-verified against C-1…C-7.
- **Docs:** AI-drafted walkthrough script mapping each decision to the rubric.

- **PROC-01 (Must):** Every AI-generated artifact (code, schema, config) is human-reviewed before
  commit — no unreviewed generation in the repo.
- **PROC-02 (Should):** Prompts/templates and the eval set are versioned in-repo as living specs.

---

## 10. Prioritization (Revised) & Rubric Traceability

### 10.1 Tiered priority matrix

| Tier                                | Items                                                                                                                                                                                                                             | Stance                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **0 — Foundation (day 1 AM)**       | EC2 + nginx + CA cert (HTTPS) · private RDS + VPC/SG · Secrets Manager · connection pool · deployed authed skeleton                                                                                                               | Airtight, first, before features        |
| **1 — Airtight core**               | AUTH (JWT, RBAC, 3+1 seed, hashed) · ENC · GEN + SSE streaming (4 SOAP + ≥1 ICD-10, structured schema, inline edit) · VER (append-only in RDS) · **HIST (tool-call injection)** · EDGE ×2 (empty input + expired-session-on-save) | Must not be sloppy                      |
| **2 — High-signal differentiators** | ICD-10 search widget (pgvector, 200–300 codes) · TMPL + live-read propagation · ADMIN (view all, filter, add/deactivate)                                                                                                          | Credible versions, not perfect          |
| **3 — If ahead**                    | Version **diff view** (pioneer #1) · red-flag detection (pioneer #2) · SESS true cross-device                                                                                                                                     | Only after Tier 0–2 solid               |
| **Cut (named, deliberate)**         | provider style-learning · bulk PDF export · AI observability dashboard                                                                                                                                                            | Explicitly out of scope for this sprint |

### 10.2 Build order (dependency-driven)

Tier 0 skeleton → AUTH → ENC (create/save to RDS) → GEN+streaming → VER → HIST → EDGE ×2 → ICD
search → TMPL → ADMIN → diff view / red-flag if time. Core loop demoable by end of day 1; day 2 is
differentiators plus hardening plus the walkthrough script.

### 10.3 Rubric traceability

| Rubric criterion        | Requirements                       |
| ----------------------- | ---------------------------------- |
| Core scribe correctness | FR-ENC-_, FR-GEN-_, FR-HIST-\*     |
| Streaming quality       | FR-GEN-01, AI-FR-05, NFR-PERF-01   |
| Database design         | DR-_, §7, FR-VER-_                 |
| Infra rigor             | C-1…C-7, NFR-SEC-\*                |
| UI quality              | NFR-UX-01                          |
| Prioritization          | §10.1 tiered matrix                |
| Non-happy-path          | FR-EDGE-01, FR-EDGE-02, AI-SAFE-02 |
| Walkthrough quality     | FR-AUTH-07, AI-FR-01, PROC-\*      |

---

## 11. Risks & Assumptions

Biggest risks: infra time-sink (TLS/VPC/Secrets) eating build time → mitigated by doing a thin
end-to-end deploy on day 1 (Tier 0) before any feature work; streaming plus tool-call interplay
complexity → prototype early, in Tier 1; scope creep on admin/templates → timebox and cut to
"credible" not "perfect," per the named cut list in §10.1. Assumption: LLM API access and quotas
are available for the full build window.
