# FRONTEND BUILD PLAN — AI Clinical Scribe (React + Tailwind + shadcn/ui)

**Version:** 1.0 · **Scope:** Frontend only (React SPA) · **Tech:** React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
**Author:** Nimat Razmjo · **Date:** 2026-07-17
**Traces to:** `docs/SRS.md` v0.2 · **Governed by:** `frontend/CLAUDE.md`

---

## 0.1 Resolved decisions (locked)

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Shared types | Author in `packages/contracts/src`; **frontend imports**, backend untouched | Single FE source of truth without backend churn |
| Contracts resolution | **npm** (no pnpm workspace); Vite + tsconfig path alias `@contracts` → `../packages/contracts/src`, consumed as source (no package.json/build) | No workspace exists; lowest friction, zero build step |
| JWT storage | **`sessionStorage`** + auth Context | Survives refresh, clears on tab close; backend has no refresh endpoint (8h TTL → re-login) |
| Styling | **Tailwind + shadcn/ui**, tokens tuned to the clinical brief (§6) | Fast primitives; defaults must be tamed, not shipped as-is |
| e2e | **Playwright against the live docker-compose backend** (seeded) | Highest fidelity — real RBAC + SSE; unit/integration stay MSW-mocked |

---

## 0. How to use this backlog

This is a JIRA-style ticket backlog mirroring the backend planning approach. Each ticket (`FE-XX`) is a **single, self-contained slice** sized for one focused implementation session. Do **not** batch multiple tickets into one prompt — implement one, get it green, commit, then pick up the next.

Every ticket ends with the same ritual: **typecheck → lint → tests → coverage gate → commit.**

Each ticket carries: dependencies, SRS trace, in-scope / explicitly-out-of-scope, implementation notes (file/hook signatures), an exhaustive test list (unit / integration / e2e with edge cases called out), acceptance criteria, and the exact commit message.

**Read order:** §1 testing standards → §2 edge-case master catalogue → §3 sequence graph → §4 the tickets.

Starting point (verified): frontend is a clean React + Vite scaffold (React 19, TypeScript 5.7, Vite 8). No Tailwind, no shadcn/ui, no auth, no feature code. FE-01 builds on top of that.

---

## 1. Testing standards (applies to every ticket)

### 1.1 The pyramid

- **Unit (most tests):** hooks (`useSoapStream`, `useDraftAutosave`, `useApiClient`), utility functions, formatters, validators. React Testing Library for component rendering without the API. Pure Vitest, all async calls mocked.
- **Integration (API+mock server):** React Query integration with a mocked API (use backend's `FakeLlmProvider` contract), streaming SSE parsing, state persistence across component mounts/unmounts, React Router navigation flows.
- **e2e (full browser, real integration):** Playwright, flows like login → start encounter → stream note → save → view history. Asserts URL, session state, rendered text, real SSE events. **Runs against the live docker-compose backend** (Postgres + API, seeded demo users) — highest fidelity, exercises real RBAC + streaming. Requires the stack up (`docker compose up -d` + seed) before the suite; `playwright.config.ts` `webServer` serves the built frontend, and `VITE_API_URL` points at the live API.

### 1.2 Determinism enablers (build in FE-01/FE-02, reuse everywhere)

- **`ApiClient` mock** implementing the backend's contract (login, encounter CRUD, generation SSE, history fetch). Supports scripted scenarios for happy path, error cases, timeouts.
- **`FakeAuthProvider`** in tests — issues deterministic tokens, handles expiry via test clock.
- **`setupFakeServer`** (using `msw` — Mock Service Worker) to intercept fetch/XHR and replay scripted responses.
- **`FixedClock`** port (same as backend) injected into hooks so date-dependent logic (token exp, timestamps) is testable.
- Test fixtures: demo user tokens, encounter data, note payloads matching backend's SOAP schema.

### 1.3 Coverage gates (enforced in CI script, wired in FE-01)

- Hooks + utilities: **≥90% lines/branches**. These are pure logic.
- Components: **≥80%**. UI state is inherently harder to cover exhaustively.
- A ticket is not "done" if it drops global coverage below the gate. `pnpm -C frontend test:cov` must pass.

### 1.4 Vitest + React Testing Library setup (configured in FE-01)

**Test files:**
- `*.spec.ts(x)` — unit tests (fast, no API calls)
- `*.int-spec.ts(x)` — integration tests (mock API, React Query)
- `*.e2e.ts` — e2e tests (Playwright, full browser)

**Scripts:**
- `test:unit` — Vitest unit only, fast
- `test:int` — Vitest with React Query + MSW
- `test:e2e` — Playwright against the live docker-compose backend (stack must be up + seeded)
- `test:cov` — all three + coverage report
- `test:ci` — all three + coverage gates

### 1.5 Definition of Done (every ticket)

1. `pnpm -C frontend tsc --noEmit` clean.
2. `pnpm -C frontend lint` clean.
3. All new + existing tests green (`test:ci`).
4. Coverage gate holds (≥90% hooks, ≥80% components).
5. No secret, password, or PHI-bearing content in session/local storage, logs, or committed files (the JWT itself lives in `sessionStorage` by decision — see §0.1).
6. Tailwind dark mode toggle (if applicable to the ticket) tested and working.
7. a11y: keyboard navigation tested, ARIA labels present where needed.
8. Conventional-commit message exactly as specified in the ticket.

### 1.6 Commit convention

Conventional Commits: `type(scope): summary`. Types: `feat`, `test`, `fix`, `refactor`, `chore`, `docs`. Scope = feature area (`auth`, `encounter`, `generation`, `templates`, …). Tests may land in the same commit as the feature (preferred).

---

## 2. Edge-case master catalogue (the "all edge cases" checklist)

Every row is an edge case the frontend must handle, with the ticket that owns its test. If a row is red at submission, that's a known gap — not a surprise.

| #    | Area              | Edge case                                          | Expected behavior                                                                  | Owned by |
|------|-------------------|----------------------------------------------------|------------------------------------------------------------------------------------|----------|
| E-47 | Auth              | Login with valid credentials                       | 200, token stored securely, redirects to /encounters                              | FE-03    |
| E-48 | Auth              | Login with invalid credentials                     | 401, error message, form clears password field, no token stored                   | FE-03    |
| E-49 | Auth              | Missing email/password fields                      | Client-side validation error shown, no API call                                   | FE-03    |
| E-50 | Auth              | Token stored and page refreshed                    | Session persists, no re-login required                                            | FE-04    |
| E-51 | Auth              | Expired token on a protected route                 | Redirect to login with 401 message; stored token cleared                          | FE-04    |
| E-52 | Auth              | Admin token visiting /encounters (provider path)   | Page renders but hides generation UI; admin dashboard accessible via /admin        | FE-04    |
| E-53 | Encounter List    | No encounters yet                                  | Empty state message, "Start new encounter" button visible                         | FE-05    |
| E-54 | Encounter List    | Encounters paginated or infinite-scroll            | List loads; scrolling/pagination fetches next batch without UI jank               | FE-05    |
| E-55 | Encounter Start   | User enters patient data                           | Form validates (names required, DOB plausible); creates encounter on submit        | FE-06    |
| E-56 | Encounter Start   | Duplicate patient (same name+DOB)                  | Backend resolves to same patient; frontend sees no error, encounter linked        | FE-06    |
| E-57 | Encounter Start   | Invalid DOB (future or implausible)                | Client-side validation error, no API call                                         | FE-06    |
| E-58 | Draft Edit        | User pastes transcript, page refreshes             | Draft auto-restored from server, cursor position lost (acceptable)                | FE-07    |
| E-59 | Draft Edit        | Rapid typing in transcript field                   | Debounced autosave (no spam); draft marked "unsaved" until server confirms        | FE-07    |
| E-60 | Draft Edit        | User selects template before generating            | Template selection persists in encounter state; generating uses selected template | FE-08    |
| E-61 | Generation        | User clicks "Generate"                             | SSE stream starts; note renders section-by-section in real-time                  | FE-09    |
| E-62 | Generation        | Mid-stream user cancels                            | Abort sent; UI reverts to draft, partial note discarded, no save                  | FE-09    |
| E-63 | Generation        | Server returns refusal (non-clinical input)        | Single "refused" event; UI shows graceful message, no note rendered               | FE-09    |
| E-64 | Generation        | Server returns error mid-stream                    | `error` event; connection closes; toast shows "generation failed"; draft intact   | FE-09    |
| E-65 | Generation        | Network timeout during stream                      | Abort after configurable timeout; user can retry; draft persists                 | FE-09    |
| E-66 | Note Editing      | User edits streamed SOAP note inline              | Assessment section editable; ICD-10 codes toggleable; UI reflects changes         | FE-10    |
| E-67 | Note Editing      | User clears a section (e.g., Assessment)          | Section marked empty but not deleted; can re-edit or save as-is                  | FE-10    |
| E-68 | Note Saving       | User clicks "Save"                                 | Version 1 created; note finalized; version history updated; UI shows "saved"     | FE-11    |
| E-69 | Note Saving       | User has expired token at save time                | 401 TOKEN_EXPIRED error; draft still on server; prompt to re-login               | FE-11    |
| E-70 | Note Saving       | User saves identical note twice                    | Each save creates a new version; history shows both with timestamps              | FE-11    |
| E-71 | Version History   | User opens version history view                    | List of all versions for encounter, sorted newest-first; who/when for each       | FE-12    |
| E-72 | Version History   | User views a specific past version                 | Read-only SOAP note rendered; version number and saved-by info shown             | FE-12    |
| E-73 | Version Diff      | User compares v1 to v2                            | Diff shows field-by-field changes (S/O/A/P); ICD-10 codes added/removed flagged  | FE-12    |
| E-74 | ICD-10 Search     | User searches for "hypertension"                   | Autocomplete returns top results; user can click to append code to Assessment     | FE-13    |
| E-75 | ICD-10 Search     | Search returns no results                          | "No matches found" message; user can try different query                         | FE-13    |
| E-76 | ICD-10 Search     | User appends code to note                          | Code added to Assessment; duplicate check (no duplicate codes)                    | FE-13    |
| E-77 | Templates         | Admin selects active template                      | Selection persists; next generation uses new template                             | FE-14    |
| E-78 | Templates         | Provider sees only active template in dropdown     | Admin-editable template list hidden from providers                                | FE-14    |
| E-79 | Admin Dashboard   | Admin views all encounters (cross-provider)       | Encounter list filterable by provider, date range; see other providers' work     | FE-15    |
| E-80 | Admin Dashboard   | Admin deactivates a provider                       | Deactivated provider cannot login; their draft preserved (read-only after logout)| FE-15    |
| E-81 | Dark Mode         | Toggle dark/light mode                             | Tailwind dark mode applies to all UI; preference persists in `localStorage` (theme survives tab close) | FE-02    |
| E-82 | Keyboard Nav      | Press Tab through login form                       | Focus outline visible, tab order logical, no focus trap                          | FE-03    |
| E-83 | Responsive        | Resize browser from desktop to mobile              | UI adapts; note sections readable on small screens; no horizontal scroll         | FE-09    |
| E-84 | Error Toast       | API returns 5xx error                              | Toast shown with retry option if applicable; user can dismiss; state preserved   | FE-02    |
| E-85 | Rate Limiting     | User hammers "Generate" button 30 times            | After N requests, 429 shown; UI disables button or shows backoff message         | FE-09    |

---

## 3. Ticket sequence & dependency graph

```
Foundation:    FE-01 (contracts + tooling) ─▶ FE-02
Auth/Session:  FE-02 ─▶ FE-03 ─▶ FE-04
Encounter UX:  FE-04 ─▶ FE-05 ─▶ FE-06 ─▶ FE-07 ─▶ FE-08
Generation:    FE-08 ─▶ FE-09 ─▶ FE-10
Versioning:    FE-10 ─▶ FE-11 ─▶ FE-12
Coding (ICD):  FE-04 ─▶ FE-13  (can run in parallel with encounter)
Templates:     FE-08 ─▶ FE-14  (live propagation tested here)
Admin:         FE-04 ─▶ FE-15
Hardening:     everything ─▶ FE-16
```

**Critical path to demoable core (do these first, in order):**
FE-01 → FE-02 → FE-03 → FE-04 → FE-05 → FE-06 → FE-07 → FE-08 → FE-09 → FE-10 → FE-11.
Everything after (FE-12–FE-16) is differentiator or hardening and can be cut from the bottom under time pressure.

---

## 4. Tickets

---

### FE-01 — Foundation: shared contracts, Tailwind + shadcn/ui, Vitest + MSW + Playwright

- **Epic:** Foundation · **Depends on:** — · **SRS:** NFR-UX-01, NFR-MAINT-01
- **Story:** As a developer, I have the shared type contracts, a configured/styled scaffold, and the full test toolchain so every later ticket has a typed, testable base.
- **Why:** Nothing else is defensible without the API contract types, Tailwind/shadcn configured, and the deterministic-mock + e2e test infra in place. This is the FE analog of BE-01 (harness) + BE-02 (shared kernel).
- **In scope:**
  - **Populate `packages/contracts/src`** (currently empty) — author the shared types the frontend imports (decision: contracts is the source of truth; FE imports, backend left as-is for now — see §7). Mirror the backend response/DTO shapes exactly:
    - `UserRole`, `EncounterStatus` enums; `SoapNote`, `Assessment`, `Icd10Suggestion`.
    - Request DTOs: `StartEncounterDto` (firstName/lastName/dateOfBirth/transcript?/templateId?), `UpdateDraftDto` (`{ draft: SoapNote }`), `SetTranscriptDto` (`{ text }`), `SaveNoteDto` (`{ soapNote: SoapNote, draftRevision? }` — icd10 **min 1**), `LoginDto`, `CreateTemplateDto`, `UpdateTemplateDto`, `CreateProviderDto`.
    - Response shapes: `EncounterDto`, `NoteVersionDto`, `TemplateDto`, `Icd10Match` (`{ code, description, score }`), auth `{ accessToken }`, `AuthMe`, `SoapNoteDiff`.
    - **SSE union** `LlmEvent = section-delta | tool-call | tool-result | done | refused | error` (see §7 for exact shape).
    - Error envelope `{ statusCode, code, message }` + known `code` literals (`TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `BAD_REQUEST`, …).
    - **No package.json / no build step and no pnpm workspace** — the frontend stays on **npm** and resolves the types as source via a path alias `@contracts` → `../packages/contracts/src` (tsconfig `paths` + matching Vite `resolve.alias`). Contracts is authored as plain `.ts` files consumed directly.
  - Add styling deps: `tailwindcss`, `postcss`, `autoprefixer`, `class-variance-authority`, `clsx`, `tailwind-merge`.
  - Add shadcn/ui deps: `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `@radix-ui/react-popover`, `lucide-react`.
  - Add test deps: `vitest`, `@vitest/ui`, `@vitest/coverage-v8`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw`, `@faker-js/faker`, `@playwright/test`, `vitest-axe` (a11y assertions).
  - Configure `tailwind.config.ts`: clinical palette via CSS variables (grays, clinical blue, alert red/yellow, success green); `darkMode: 'class'`.
  - Configure `postcss.config.js`, `vitest.config.ts` (jsdom, MSW global setup, coverage thresholds per §1.3, `@/*`→`src/*` + `@contracts`→`../packages/contracts/src` aliases), and `playwright.config.ts` (`webServer` boots the app; e2e runs against the **live docker-compose backend** — see §1.4).
  - Create `src/lib/`: `cn()` (clsx + tailwind-merge), `formatters.ts`. Create `src/api/`: typed `apiClient` skeleton (base URL from `VITE_API_URL`, error-envelope parse) — fleshed out in FE-03/FE-04.
  - Create `src/test/`: `setupServer.ts` (MSW handlers stubbed 404 until wired), `sseMock.ts` (scripted `ReadableStream` SSE scenarios: clean SOAP, tool+history, malformed line, mid-stream error, refused), `fixtures/` (demo tokens/encounters/notes matching contracts), `renderWithProviders.tsx`.
  - Global `src/index.css` with Tailwind directives layered over the existing clinical CSS variables; `src/App.tsx` placeholder + React Router provider (no full routes yet).
- **Out of scope:** any feature code, auth logic, real API calls. Refactoring the **backend** to import from contracts (tracked as a separate BE follow-up, not this plan).
- **Implementation notes:**
  - Tailwind: keep clinical colors as CSS variables so dark mode flips them; do **not** adopt shadcn's default rounded/soft look wholesale — tune tokens toward the dense clinical brief (see §6).
  - shadcn/ui: `npx shadcn-ui@latest init`; install `Button` + `Card` as smoke examples.
  - MSW is the FE analog of the backend `FakeLlmProvider`; `sseMock.ts` replays streams so `useSoapStream` is testable without a live model.
- **Tests:**
  - unit: `cn()` merges Tailwind classes without conflict; `formatters` correct; contracts fixtures type-check against the authored types.
  - unit: `sseMock` emits scripted events in order and terminates on done/error/refused.
  - e2e (smoke, Playwright): app loads, no console errors, router renders placeholder.
- **Acceptance:** `pnpm -C frontend test:ci` green across unit/integration/e2e; `pnpm -C frontend build` succeeds; `@contracts` types import cleanly in the app; Tailwind + shadcn usable.
- **Commit:** `chore(core): contracts types, tailwind + shadcn, vitest + msw + playwright setup`

---

### FE-02 — Global layout, theme toggle, error toast system

- **Epic:** Foundation · **Depends on:** FE-01 · **SRS:** NFR-UX-01
- **Story:** As the system, I provide a consistent clinical layout, dark mode, and error feedback so every page has a safe base.
- **In scope:**
  - `src/components/Layout.tsx`: header (logo, user menu, nav), sidebar (encounter list quick link), main content area. Structured with semantic HTML.
  - Dark mode toggle in header; persists to `localStorage` (theme is a durable pref, unlike the JWT) + applies via `document.documentElement.classList`.
  - Global error toast/notification system using a Context (`ToastContext`) + hook (`useToast`).
  - `src/components/Toast.tsx`: renders active toast(s) in corner; auto-dismiss after 5s; user can dismiss manually.
  - Clinical color palette: grays for text/borders, blue for primary action, red for alert, green for success, yellow for warning.
  - Typography hierarchy: clinical sans-serif (e.g., system stack), dense spacing, high contrast ratios (WCAG AA minimum).
- **Out of scope:** routing beyond a placeholder, auth state, feature-specific nav.
- **Implementation notes:**
  - Use Tailwind's `dark:` variant for dark mode styles.
  - Toast system: uses Tailwind + shadcn/ui Card for styling; supports different types (info, error, success, warning).
  - Layout: use CSS Grid or Flexbox to keep nav/content responsive.
- **Tests:**
  - unit: dark mode toggle wires to `localStorage` and CSS class.
  - unit: `useToast()` hook queues/dismisses toasts correctly.
  - integration: RTL renders Layout with child content; toast appears and auto-dismisses.
  - e2e: toggle theme, refresh page, theme persists.
- **Acceptance:** layout renders consistently; dark mode toggles without jank; toasts appear and dismiss as expected.
- **Commit:** `feat(core): global layout, dark mode toggle, error toast system`

---

### FE-03 — Auth: login form, token storage, session check

- **Epic:** Auth · **Depends on:** FE-02 · **SRS:** FR-AUTH-03, E-47..E-49, E-82
- **Story:** As a provider, I log in with email/password and receive a session so I can access encounters.
- **In scope:**
  - `src/features/auth/LoginPage.tsx`: form with email + password fields.
  - Form validation (email format, password required) via `zod` or similar.
  - `POST /auth/login` call via `apiClient`; on success, store JWT in **`sessionStorage`** + auth Context (decision: survives refresh, clears on tab close; backend has no refresh endpoint so an expired 8h token means re-login).
  - `useAuthApi()` hook: wraps login call, handles loading/error states, incl. login rate-limit `429` messaging (backend throttles login 5/60s).
  - On login success: redirect to `/encounters`.
  - On login error: show error toast, clear password field, keep email visible.
  - Keyboard navigation tested (Tab through form).
- **Out of scope:** password reset, social login, MFA, refresh tokens.
- **Implementation notes:**
  - Token storage: `sessionStorage` (single key) + auth Context; cleared on logout and on any `401 TOKEN_EXPIRED`. Never store PHI or the password.
  - Form: use shadcn/ui Form components or a simple controlled input + validation.
  - API Client: `async login(email, password): Promise<{ token: string }>`.
- **Tests:**
  - unit: form validation rejects bad email, empty password.
  - integration (MSW): login with valid creds returns token; login with invalid creds returns 401; token stored in context.
  - e2e: login flow end-to-end (Playwright), verify redirect to `/encounters`.
- **Acceptance:** login works; tokens stored; invalid creds shown to user; keyboard nav works.
- **Commit:** `feat(auth): login form and token storage`

---

### FE-04 — Session management: token persistence, auto-logout, protected routes

- **Epic:** Auth · **Depends on:** FE-03 · **SRS:** FR-AUTH-04, E-50, E-51
- **Story:** As a provider, my session persists across page refreshes and expires gracefully.
- **In scope:**
  - `AuthContext` + `useAuth()` hook: checks `sessionStorage` for token on app load; verifies token via `GET /auth/me`; stores user (id, role, email).
  - `ProtectedRoute` component: wraps routes that need auth; redirects to login if no token or 401 returned.
  - On 401 (expired token): clear token, redirect to login, show message "Session expired".
  - Role-based rendering: Provider sees `/encounters` path; Admin sees `/admin` path. Both protected.
  - `useAuthGuard()` hook: checks if current user has required role(s); used by components to hide/show UI.
- **Out of scope:** token refresh / refresh tokens (note as future). Assume tokens are short-lived and re-login is expected.
- **Implementation notes:**
  - On app boot, AuthContext checks `sessionStorage` + calls `/auth/me` to validate.
  - If `/auth/me` returns 401, token is stale; clear it, user goes to login on next protected route.
  - React Router: define route guards as middleware or higher-order components.
- **Tests:**
  - integration: token stored in `sessionStorage`, app reloads, AuthContext rehydrates from it.
  - integration: /auth/me returns 401, token is cleared, next protected route redirects to login.
  - e2e: login, navigate, refresh page, still authenticated.
- **Acceptance:** session persists; expired tokens handled gracefully; role-based access works.
- **Commit:** `feat(auth): session persistence, protected routes, auto-logout`

---

### FE-05 — Encounters: list view, empty state, basic CRUD UI

- **Epic:** Encounter · **Depends on:** FE-04 · **SRS:** FR-ENC-01, FR-ENC-06, E-53, E-54
- **Story:** As a provider, I see my encounters and can start a new one.
- **In scope:**
  - `GET /encounters` call wrapped in `useEncountersQuery()` (React Query hook).
  - `src/features/encounter/EncounterListPage.tsx`: table or list of encounters (patient name, date, status, actions).
  - Empty state: "No encounters yet. Start a new one" with button.
  - "New Encounter" button navigates to encounter form (FE-06).
  - Sorting/filtering by date (optional; "Nice to have" for now).
- **Out of scope:** pagination (simple list first), encounter detail view.
- **Implementation notes:**
  - React Query: `useQuery()` for GET /encounters; cache, refetch on mount.
  - shadcn/ui Table or similar for rendering list.
- **Tests:**
  - integration (RTL + React Query): no encounters → empty state renders.
  - integration: encounters fetched and rendered in list.
  - e2e: navigate to list, see encounters or empty state.
- **Acceptance:** list renders; empty state shown when appropriate; new encounter button works.
- **Commit:** `feat(encounter): encounter list view with empty state`

---

### FE-06 — Encounters: start encounter form (patient resolution)

- **Epic:** Encounter · **Depends on:** FE-05 · **SRS:** FR-ENC-01, E-55..E-57
- **Story:** As a provider, I enter patient info and start an encounter.
- **In scope:**
  - `src/features/encounter/StartEncounterPage.tsx`: form (first name, last name, DOB).
  - Client-side validation: names required, DOB plausible (not future, not impossibly old).
  - `POST /encounters` call with validated data; backend resolves/creates patient.
  - On success: navigate to encounter detail page (FE-07).
  - On error: show toast (e.g., "Patient validation failed").
- **Out of scope:** patient search/history UI (that's in draft restore, FE-07).
- **Implementation notes:**
  - Form state via React hooks or `react-hook-form` + `zod`.
  - Validation: `zod` schemas for client-side, API error handling for server-side.
- **Tests:**
  - unit: form validation (invalid DOB → error; valid fields → submit enabled).
  - integration (RTL + MSW): submit valid form → API call made; success → navigate.
  - e2e: full flow start → encounter created.
- **Acceptance:** form validates; encounter created on backend; redirect works.
- **Commit:** `feat(encounter): start-encounter form with validation`

---

### FE-07 — Encounters: draft edit & autosave (session persistence)

- **Epic:** Encounter · **Depends on:** FE-06 · **SRS:** FR-SESS-01/02, FR-ENC-02, E-58, E-59
- **Story:** As a provider, I edit the transcript and it autosaves so I never lose work.
- **In scope:**
  - `src/features/encounter/EncounterPage.tsx`: main encounter workspace.
  - Transcript textarea with debounced autosave to `PATCH /encounters/:id/draft`.
  - Visual indicator: "Saving..." / "Saved" / "Unsaved changes" based on autosave status.
  - On page reload: restore transcript from server (backend returns it in `GET /encounters/:id`).
  - `useDraftAutosave()` hook: debounces input, triggers save, shows state.
- **Out of scope:** generation (FE-09), version history (FE-11), inline note editing (FE-10).
- **Implementation notes:**
  - Autosave debounce: 1.5–2 seconds without keystroke.
  - Draft state: local component state vs. server state; UI shows which one is current.
  - On mount, fetch encounter and populate textarea.
- **Tests:**
  - unit: debounce logic works (mock timer + events).
  - integration: rapid keypresses → single debounced API call.
  - integration: page reload → draft restored from API.
  - e2e: edit transcript, hard-refresh browser, content still there.
- **Acceptance:** autosave works without UI jank; draft survives reload.
- **Commit:** `feat(encounter): draft-edit and debounced autosave`

---

### FE-08 — Templates: selection UI (live propagation verification)

- **Epic:** Template · **Depends on:** FE-07 · **SRS:** FR-TMPL-01/02, E-60
- **Story:** As a provider, I select a template before generating so the AI uses the right prompt.
- **In scope:**
  - `GET /templates` (provider sees only active) hook: `useTemplatesQuery()`.
  - Template selector dropdown/radio group in encounter page (before generate button).
  - Selected template persists in encounter state (sent to backend on generate).
  - Visual feedback: "Using template: [name]" or similar.
  - If no active templates exist: fallback UI "No templates available" (shouldn't happen in demo, but safe).
- **Out of scope:** admin template CRUD (that's FE-14).
- **Implementation notes:**
  - React Query for template list.
  - Template selection: local state in encounter context or URL parameter.
- **Tests:**
  - integration: fetch templates, render selector, selection persists.
  - unit: selected template included in generate request payload.
- **Acceptance:** templates load; selection works; selected template sent to backend.
- **Commit:** `feat(template): provider template selector`

---

### FE-09 — Generation: SSE streaming, progressive render, cancel, error handling

- **Epic:** Scribe · **Depends on:** FE-08 · **SRS:** FR-GEN-01/02/05, FR-EDGE-01, NFR-PERF-01, E-61..E-65, E-83, E-85
- **Story:** As a provider, I click Generate and watch the SOAP note stream in token-by-token with a cancel button.
- **In scope:**
  - `POST /encounters/:id/generate` SSE stream via `fetch()` + `ReadableStream`.
  - Parse SSE events: `section-delta`, `tool-call`, `refused`, `error`, `done`.
  - `useSoapStream()` hook: manages AbortController, parses events, updates note state progressively.
  - UI: "Generate" button disabled while streaming; "Cancel" button visible during stream.
  - Progressive render: sections appear as they stream (S → O → A → P).
  - Refusal path: single `refused` event → show graceful message "This input isn't clinical enough…", no note rendered.
  - Error path: `error` event → show toast, abort stream, draft remains intact, user can retry.
  - Timeout: if no data for 30s, abort and show error.
  - Mobile responsive: sections readable on small screens (no horizontal scroll).
- **Out of scope:** inline note editing (FE-10), saving (FE-11).
- **Implementation notes:**
  - Fetch API: create AbortController, pass to fetch. On cancel or error, call `abort()`.
  - Stream parsing: ReadableStream reader → text decoder → split by `\n\n` (SSE format).
  - State: streaming status, partial note, error message.
  - Rate limiting: if user hammers "Generate" and server returns 429, show backoff message.
- **Tests:**
  - unit: SSE event parser (delta, refusal, error events).
  - unit: AbortController cancels stream correctly.
  - integration (RTL + fake stream): start stream, parse events, render sections progressively.
  - e2e (Playwright): click generate, see streaming, click cancel, stream aborts.
- **Acceptance:** streaming visible and progressive; cancel works; errors handled; timeout enforced.
- **Commit:** `feat(generation): SSE streaming generation with cancel and error handling`

---

### FE-10 — Generation: inline note editing, ICD-10 code toggles

- **Epic:** Scribe · **Depends on:** FE-09 · **SRS:** FR-ENC-04, FR-GEN-02/03, E-66, E-67
- **Story:** As a provider, I edit the streamed SOAP note and toggle ICD-10 codes before saving.
- **In scope:**
  - SOAP note UI: each section (S/O/A/P) is editable (contenteditable or textarea).
  - Assessment section: list of ICD-10 codes with checkboxes or toggles to include/exclude.
  - Requirement: ≥1 ICD-10 code selected (backend enforces, but UI hints this).
  - Visual: selected codes highlighted, unselected grayed out.
  - Changes tracked locally; not auto-saved until explicit save (FE-11).
- **Out of scope:** ICD-10 search/autocomplete (that's FE-13), validation error display.
- **Implementation notes:**
  - Note state: object with s, o, a (text + icd10 array), p.
  - Edit handlers: update state on field change.
  - Code toggles: simple checkbox → update icd10 array.
- **Tests:**
  - unit: note state update on text change; code toggle adds/removes from array.
  - integration (RTL): render note, edit field, verify state; toggle code checkboxes.
- **Acceptance:** all sections editable; codes toggleable; state tracked.
- **Commit:** `feat(generation): inline SOAP editing with ICD-10 code toggles`

---

### FE-11 — Versioning: save note, version history list, read-only view

- **Epic:** Versioning · **Depends on:** FE-10 · **SRS:** FR-VER-01/02/03, FR-ENC-05, E-68..E-70
- **Story:** As a provider, I save the note and see its version history.
- **In scope:**
  - "Save Note" button in encounter page; calls `POST /encounters/:id/notes` with edited SOAP + ICD-10 codes.
  - On success: version 1+ created; encounter marked Finalized; UI shows "Note saved" toast.
  - `GET /encounters/:id/versions` hook: `useVersionsQuery()`.
  - Version history list: shows all versions, newest first; displays who saved and when.
  - Clicking a version: shows read-only view of that version's SOAP note.
  - Encounter marked as Finalized: new draft can't edit the saved version (but can start a new draft if backend allows).
- **Out of scope:** version diff view (FE-12).
- **Implementation notes:**
  - Save: include `draftRevision` for idempotency (backend uses this).
  - Version state: switch between live-draft and read-only-version views.
  - React Query: refetch versions on successful save.
- **Tests:**
  - integration (RTL + React Query): save note, versions list updates.
  - integration: click version, show read-only note.
  - e2e: save, navigate to history, view specific version.
- **Acceptance:** save works; versions list accurate; read-only view works.
- **Commit:** `feat(versioning): save note and version-history list with read-only view`

---

### FE-12 — Versioning: version diff view (pioneer feature)

- **Epic:** Versioning · **Depends on:** FE-11 · **SRS:** §Pioneer
- **Story:** As a provider, I see exactly what changed between two note versions.
- **In scope:**
  - `GET /encounters/:id/versions/diff?from=X&to=Y` endpoint (backend provides structured diff).
  - Diff UI: side-by-side or unified view of S/O/A/P changes; color-code added/removed/modified lines.
  - ICD-10 code set diff: show codes added/removed.
  - Link to diff from version history (e.g., "Compare to previous").
- **Out of scope:** three-way diffs, merge logic.
- **Implementation notes:**
  - Parse backend diff response; render with Tailwind colors (green for added, red for removed).
  - Use a diff library (e.g., `diff-match-patch`) or simple line-by-line comparison.
- **Tests:**
  - unit: diff rendering (mock diff data).
  - e2e: navigate to two versions, view diff.
- **Acceptance:** diff accurate; UI clear.
- **Commit:** `feat(versioning): structured diff between note versions`

---

### FE-13 — Coding: ICD-10 search autocomplete & code append

- **Epic:** Coding · **Depends on:** FE-04 · **SRS:** FR-ICD-01/02/03, E-74..E-76
- **Story:** As a provider, I search ICD-10 codes and add them to the note.
- **In scope:**
  - Search widget (autocomplete input) in encounter page, near Assessment section.
  - `GET /icd10/search?q=` hook: `useIcd10Search(query)`.
  - Debounced search as user types (300ms debounce).
  - Results dropdown: code, description, relevance score.
  - Clicking a result: appends code to Assessment section (if not already present).
  - Duplicate prevention: can't add the same code twice.
- **Out of scope:** advanced ICD-10 filtering, bulk import.
- **Implementation notes:**
  - Autocomplete: shadcn/ui Popover + list, or custom dropdown.
  - Debounce: `useMemo` with delay.
  - State: search query, results, selected index (for keyboard nav).
- **Tests:**
  - unit: debounce logic.
  - integration (RTL + React Query): search, results render, click appends code.
  - integration: duplicate codes rejected.
  - e2e: search workflow end-to-end.
- **Acceptance:** search works; results accurate; append works; duplicates rejected.
- **Commit:** `feat(coding): ICD-10 semantic search with code append`

---

### FE-14 — Templates: admin CRUD & live propagation

- **Epic:** Template · **Depends on:** FE-08 · **SRS:** FR-TMPL-01/02/03/04, E-77, E-78
- **Story:** As an admin, I manage templates and changes take effect immediately.
- **In scope:**
  - Admin-only routes: `/admin/templates`.
  - Template CRUD UI: list, create, edit, delete; "Make Active" toggle.
  - Only one active template at a time (or documented rule).
  - Editing a template: form for name, prompt_body, encounter_type.
  - On save: new template active immediately; next provider generation uses it (verified via e2e).
  - Provider template selector: shows only active templates.
- **Out of scope:** template versioning, template preview (nice-to-have).
- **Implementation notes:**
  - CRUD: POST /templates, PUT /templates/:id, DELETE /templates/:id, GET /templates (admin sees all).
  - React Query: invalidate template cache after mutation.
  - UI: toggle for "is_active" or explicit "Make Active" button.
- **Tests:**
  - integration (RTL + React Query): CRUD operations, active status persists.
  - e2e: admin edits template, provider sees new template in selector, generates with new prompt.
- **Acceptance:** admin can CRUD; live propagation verified.
- **Commit:** `feat(template): admin template CRUD with live propagation`

---

### FE-15 — Admin dashboard: encounter oversight, provider roster

- **Epic:** Admin · **Depends on:** FE-04 · **SRS:** FR-ADMIN-01/02/03, E-79, E-80
- **Story:** As an admin, I see all encounters and manage providers.
- **In scope:**
  - `/admin/encounters`: table of all encounters (across providers), filterable by provider + date range.
  - `/admin/providers`: provider roster with add/deactivate actions.
  - Add provider form: email, role (provider/admin by default is provider), initial password (backend sends?).
  - Deactivate: soft-delete, provider can't login after (if they were active).
  - RBAC: providers can't see these routes.
- **Out of scope:** deep audit trail UI (basic listing only).
- **Implementation notes:**
  - Filters: provider dropdown, date-range picker (Tailwind + Popover for calendar).
  - Encounter table: patient name, date, provider, status, actions.
  - React Query: queries for encounters and providers.
- **Tests:**
  - integration (RTL): fetch and render admin lists.
  - e2e: admin filters encounters, adds provider, deactivates provider.
- **Acceptance:** admin views work; filters work; RBAC enforced (providers 403 on admin routes).
- **Commit:** `feat(admin): cross-provider encounter oversight and roster management`

---

### FE-16 — Hardening: a11y audit, security review, regression test suite

- **Epic:** Cross-cutting · **Depends on:** all · **SRS:** NFR-UX-01, NFR-SEC-05
- **Story:** As the owner, I harden the UX and lock in a green regression before submission.
- **In scope:**
  - a11y: keyboard navigation audit (Tab, Enter, Escape), screen-reader labels, ARIA roles, focus management.
  - a11y: color contrast check (WCAG AA minimum on all text).
  - Security: no token/secret leaks in session/local storage or console logs.
  - Regression: full e2e flow (login → encounter → generate → save → view history).
  - Performance: no console errors; streaming latency < 2s to first token (browser-side measurement).
  - Dark mode: test all pages in both light and dark.
- **Out of scope:** deep performance profiling.
- **Implementation notes:**
  - a11y tools: `axe-core`, `jest-axe` for automated checks; manual keyboard test.
  - E2E regression: scripted flow covering auth, encounter, generation, save, history.
  - Logging audit: scan captured logs, session storage, and local storage for sensitive strings.
- **Tests:**
  - unit (jest-axe): render critical components, check for violations.
  - e2e regression: full happy-path flow.
  - e2e dark mode: every page tested in both themes.
- **Acceptance:** a11y passes; regression green; no sensitive data leaks; dark mode works.
- **Commit:** `chore(core): a11y audit, security hardening, regression test suite`

---

## 5. Not in this frontend backlog (explicit scope boundary)

Backend (NestJS API, generation orchestration, versioning, audit) and infra (AWS, nginx, TLS, Secrets Manager) are **out of scope here** — they live in their own plans. The frontend consumes the backend's API contract (login endpoint, encounter CRUD, SSE generation, history fetch); keep that stable. Deliberately deferred features: provider style customization, PDF export, analytics dashboard, multi-device draft restore (single-device/browser is covered in FE-07).

---

## 6. Tailwind + shadcn/ui specifics

### Color palette (clinical-safe)

```css
/* Tailwind config — clinical palette */
colors: {
  slate:   { 50: '#f8fafc', 900: '#0f172a', ... },      /* grays */
  blue:    { 600: '#2563eb', 700: '#1d4ed8', ... },    /* primary clinical */
  red:     { 500: '#ef4444', 600: '#dc2626', ... },    /* alert/error */
  yellow:  { 500: '#eab308', 600: '#ca8a04', ... },    /* warning */
  green:   { 500: '#22c55e', 600: '#16a34a', ... },    /* success */
  /* dark mode variants handled via Tailwind's `dark:` prefix */
}
```

### shadcn/ui components used

- `Button` — primary/secondary actions (generate, save, cancel)
- `Card` — encounter cards, note sections
- `Input` — form fields (email, password, patient name, search)
- `Textarea` — transcript, note sections
- `Popover` — template/ICD-10 dropdowns, date picker
- `Dialog` — confirm dialogs (deactivate provider, delete template)
- `Toast` — notifications (errors, success)
- `Table` — encounter list, version history, provider roster
- `Badge` — status labels (draft, finalized, version number)
- `Skeleton` — loading placeholders (while fetching encounters)

All styled with Tailwind; dark mode via `dark:` utilities.

> **Taming shadcn toward the clinical brief.** shadcn defaults lean consumer-polished (large radii, soft
> shadows, generous padding, playful focus rings) — which fights `frontend/CLAUDE.md`'s "dense,
> functional, zero bubbliness" rule. On install, override the base tokens: tighten `--radius` (≤4px),
> drop decorative shadows, reduce control padding for density, and restrict color to functional status
> only (no gradients/brand accents). Treat generated components as a starting point to restyle, not
> drop-in final UI.

---

## 7. Architecture principles (mirrored from backend)

- **API contract ownership:** shared types live in `packages/contracts` and the **frontend imports them**
  (authored in FE-01). Backend continues to define its own DTOs for now; aligning it to import from
  contracts is a separate BE follow-up. Never hand-duplicate a type on the FE side.
- **Streaming (non-negotiable, from CLAUDE.md):** `fetch()` + `ReadableStream`, never `EventSource`
  (JWT must ride the `Authorization` header). Every stream owns an `AbortController`; unmount, patient
  switch, or explicit Cancel aborts it — no state set on an unmounted component, no two streams racing
  the same note.
- **State split:** server state (encounters, versions, templates, ICD-10) via React Query; local UI
  state (draft buffer, streaming accumulator) is component/hook state. Draft persistence is
  server-backed debounced autosave, not client-side storage.
- **Hook-based state:** complex async logic lives in custom hooks (`useSoapStream`, `useAuthApi`,
  `useDraftAutosave`, `useIcd10Search`), not scattered in components.
- **Test-first mindset:** every hook and component has unit + integration tests; no untested paths.
- **Accessible by default:** semantic HTML, keyboard nav, ARIA labels, focus management when a stream
  finishes.
- **Clinical UX:** dense, scannable, high-trust. No consumer-app fluff.

### 7.1 API request quirks the FE must respect (from `backend/TESTING.md`)

These are non-obvious payload shapes the frontend must get right — encode them in the FE-01 contracts
types so they can't be gotten wrong:

- **Start encounter** (`POST /encounters`): body is `firstName` / `lastName` / `dateOfBirth`
  (+ optional `transcript`, `templateId`) — **not** `patientId`. Backend resolves-or-creates the patient.
- **Draft autosave** (`PATCH /encounters/:id/draft`): SOAP wrapped as `{ "draft": { …S/O/A/P… } }`.
- **Set transcript** (`PATCH /encounters/:id/transcript`): `{ "text": "…" }`.
- **Save note** (`POST /encounters/:id/notes`): `{ "soapNote": { … }, "draftRevision"? }`; every SOAP
  section must be non-empty **and** `assessment.icd10` must have **≥ 1** item (empty array → 400). The UI
  must block save until this holds.
- **Generate** (`POST /encounters/:id/generate`): SSE only works on `draft` status; a finalized encounter
  streams `{ type: 'error', message: 'Encounter is already finalized' }`. Disable Generate once finalized.
- **Auth:** token TTL is 8h; expiry returns `401 { code: 'TOKEN_EXPIRED' }` — the save-time expiry path
  (FE-11 / E-69) keys off this code to preserve unsaved work and prompt re-login with zero data loss.
- **ICD-10 search** (`GET /icd10/search?q=`): empty `q` → 400; debounce and skip empty queries client-side.

### 7.2 SSE event union (exact — the `useSoapStream` parse target)

Each stream frame is a line `data: {json}\n\n`. Accumulate `section-delta.text` per section; the stream
always terminates on `done`, `error`, or `refused`.

```ts
type SectionKey = 'subjective' | 'objective' | 'assessment' | 'plan';

type LlmEvent =
  | { type: 'section-delta'; section: SectionKey; text: string }
  | { type: 'tool-call';   toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolName: string; result: unknown }
  | { type: 'refused';     reason: string }
  | { type: 'error';       message: string }
  | { type: 'done';        rawContent: string };
```

