# Frontend Manual Test Plan

Base URL: http://localhost:3001 (production compose) or http://localhost:5173 (dev)

Seed accounts (run `pnpm run seed` in `backend/` first):

- Provider — `dr.alice@demo.clinic` / `DemoPass1!`
- Provider — `dr.bob@demo.clinic` / `DemoPass2!`
- Admin — `admin@demo.clinic` / `AdminPass1!`

---

## 1. Auth

### 1.1 Login — validation
1. Navigate to `/login`
2. Submit empty form → both "Email is required" and "Password is required" errors appear inline
3. Enter `notanemail` in email → "Enter a valid email address" error
4. Fix email, leave password empty → only password error remains
5. Enter wrong credentials → toast or inline error; password field cleared, focus returns to password

### 1.2 Login — success (Provider)
1. Enter `dr.alice@demo.clinic` / `DemoPass1!` → redirects to `/encounters`
2. Header shows email and "Sign out" button
3. Nav shows "Encounters" only (no "Admin" link)

### 1.3 Protected routes — unauthenticated
1. While logged out, navigate to `/encounters` → redirected to `/login`
2. Navigate to `/encounters/new` → redirected to `/login`
3. Navigate to `/admin` → redirected to `/login`

### 1.4 Role guard — Provider cannot access Admin
1. Log in as Provider
2. Navigate to `/admin` manually → redirected away (encounters or login)

### 1.5 Already-authenticated redirect
1. While logged in, navigate to `/login` → immediately redirected to `/encounters`

### 1.6 Logout
1. Click "Sign out" → redirected to `/login`; navigating to `/encounters` redirects back to `/login`

---

## 2. Global Layout

### 2.1 Dark mode
1. Click the moon/sun icon in the header
2. Page switches between light and dark
3. Preference persists on page refresh

### 2.2 Navigation active state
1. On `/encounters` — "Encounters" link has highlighted style
2. On `/admin/*` (Admin user) — "Admin" link has highlighted style

### 2.3 Unknown route
1. Navigate to `/does-not-exist` → redirected to `/encounters`

---

## 3. Encounter List (`/encounters`)

### 3.1 Empty state
1. Log in as a fresh Provider → list shows empty state message (no encounters)

### 3.2 Populated list
1. After creating encounters, list shows patient names, dates, statuses
2. Each row is clickable and navigates to `/encounters/:id`

### 3.3 New encounter button
1. "New encounter" button is visible for Provider role
2. Clicking it navigates to `/encounters/new`

---

## 4. Start Encounter (`/encounters/new`)

### 4.1 Validation
1. Submit empty form → all three field errors appear
2. Enter DOB = today → "Date of birth must be in the past"
3. Enter DOB = 200 years ago → "Date of birth is implausibly old"
4. Fix errors one at a time → each error clears when the field is corrected

### 4.2 Cancel
1. Click "Cancel" → navigates back to `/encounters` without creating anything

### 4.3 Successful creation
1. Fill: First `Jane`, Last `Smith`, DOB `1980-03-15`
2. Click "Start encounter" → button shows "Starting…" while in-flight
3. On success → navigates to `/encounters/:id` for the new encounter
4. Patient name and DOB visible in the encounter header

### 4.4 API error
1. Simulate API failure (kill the API container briefly) → toast appears with error message; form stays filled

---

## 5. Encounter Page (`/encounters/:id`)

### 5.1 Header
1. Patient name (`Jane Smith`) and formatted DOB visible
2. Back arrow navigates to `/encounters`

### 5.2 Transcript — editing and autosave
1. Click into the transcript textarea and type some text
2. Status indicator cycles: `Unsaved changes` → `Saving…` → `Saved` (after ~1s debounce)
3. Refresh page → transcript content is restored from server

### 5.3 Transcript — empty state guard
1. Clear the transcript completely
2. "Generate note" button is disabled and shows a tooltip "Add a transcript first"

### 5.4 Template selector
1. Dropdown lists only active templates
2. Selecting a template updates the selected value; deselect returns to default
3. Selected template id is sent with the generate request

### 5.5 Generate — happy path
1. Paste a clinical transcript (example below), select any template
2. Click "Generate note"
3. Button disappears; "Cancel" button appears
4. SOAP note section fades in token-by-token with "Generating…" spinner
5. On completion — spinner gone, "Save note" button appears

**Sample transcript:**
```
Patient: Jane Smith, 44F. Chief complaint: right knee pain for 3 weeks.
HPI: Progressive pain with activity, mild swelling, no locking. PMH: HTN.
Meds: lisinopril 10mg. Exam: antalgic gait, right knee effusion, tender
medial joint line, McMurray negative. A: medial knee pain, likely
degenerative meniscal tear. P: MRI right knee, NSAIDs, PT referral.
ICD-10 discussed: M23.202 (derangement of unspecified meniscus, right knee).
```

### 5.6 Generate — cancel mid-stream
1. Click "Generate note"
2. While streaming, click "Cancel"
3. Stream stops; note shows partial content; "Generating…" indicator disappears
4. "Generate note" button returns

### 5.7 Generate — non-clinical transcript (guardrail)
1. Enter transcript: `hello world this is not clinical`
2. Click "Generate note"
3. Yellow warning box appears: "Note generation declined" with a reason message
4. No SOAP note sections rendered

### 5.8 SOAP note — inline editing
1. After generation completes, click into any SOAP section (S, O, A, P)
2. Text is editable
3. Edits are reflected immediately in the note state

### 5.9 ICD-10 search (inside SOAP note)
1. In the Assessment or Plan section, locate the ICD-10 search widget
2. Type `knee` → debounce fires, dropdown appears with matching codes
3. Type fewer than 2 characters → no dropdown
4. Click a result → code is added to the note; that code now shows "(added)" and is disabled
5. Clicking outside the dropdown closes it
6. Press the search input after closing → dropdown reopens with previous results

### 5.10 Save note
1. After generation, click "Save note" → button shows "Saving…" with spinner
2. On success → note is saved; version history panel appears (or updates)
3. Saved note survives a page refresh

### 5.11 Version history — expand/collapse
1. After saving at least one version, "Version history (N)" section appears at the bottom
2. Click the toggle → list of versions expands; click again → collapses
3. Versions are sorted newest-first (v2 before v1)

### 5.12 Version history — view a version
1. Click "View" on any version → read-only SOAP note expands inline
2. Click "Close" → collapses

### 5.13 Version history — diff view
1. With ≥ 2 versions, click "Diff vs prev" on v2
2. Diff view expands showing changes between v1 and v2
3. Click "Hide diff" → collapses

### 5.14 Finalized encounter
1. After an encounter is finalized (admin sets status or via API), open it
2. Transcript textarea is read-only (no cursor, muted bg)
3. "Finalized" badge visible in header
4. Generate and Save buttons are absent
5. SOAP note sections are read-only

---

## 6. Session Expiry Rescue

1. Open an encounter, generate a note but do NOT save
2. Invalidate the JWT (expire it via the API or manually clear the cookie but keep the note on screen)
3. Click "Save note"
4. Error appears: "Session expired — your edits were preserved. Re-login to continue."
5. Navigate to `/login`, log back in
6. Navigate back to the same encounter
7. The unsaved note content is restored from `sessionStorage` automatically (note is pre-populated)
8. Click "Save note" — succeeds this time

---

## 7. Admin — Templates (`/admin/templates`)

Log in as Admin. Navigate to `/admin/templates`.

### 7.1 List
1. Table renders: Name, Type, Status (Active/Inactive), Updated columns
2. Empty state shows "No templates yet" message

### 7.2 Create
1. Click "New template"
2. Fill Name, Encounter type (optional), Prompt body
3. Click "Create template" → form disappears; new row appears in table with "Active" status

### 7.3 Edit
1. Click the pencil icon on a template → form pre-fills with existing values
2. Update the name → "Save changes" → row updates in table

### 7.4 Toggle active/inactive
1. Click the "Active" badge on a template → it flips to "Inactive" (muted style)
2. Click "Inactive" → flips back to "Active"
3. Verify in the Provider's template selector: inactive templates are hidden; active templates appear

### 7.5 Delete
1. Click the trash icon → browser confirm dialog appears
2. Confirm → row is removed from the table
3. Cancel → row remains

### 7.6 Form validation
1. Submit the New template form with empty Name → native `required` validation fires

---

## 8. Admin — Encounters (`/admin/encounters`)

1. Navigate to `/admin/encounters`
2. All encounters (across all providers) are listed
3. Encounter rows are visible with patient info and status

---

## 9. Admin — Providers (`/admin/providers`)

1. Navigate to `/admin/providers`
2. Provider accounts are listed

---

## 10. Toast Notifications

### 10.1 Error toast
1. Trigger any API error (e.g. network down during encounter creation)
2. Toast appears in corner with error styling and message
3. Toast auto-dismisses or has a close button

### 10.2 Does not stack indefinitely
1. Rapidly trigger multiple errors
2. Toasts stack or replace without breaking layout

---

## 11. Error Boundary

1. Force a render error (temporarily break a component in dev mode)
2. Error boundary catches it and renders a fallback UI instead of a blank screen

---

## 12. Accessibility Spot-checks

1. Tab through the login form — all fields and the submit button are reachable in order
2. On encounter page, tab to "Generate note" and press Enter — triggers generation
3. ICD-10 dropdown results are navigable via keyboard (Tab/Enter to select)
4. Dark mode has sufficient contrast on text and error states
5. Screen reader: form error messages are announced (they use `role="alert"`)
6. "Back to encounters" arrow button has a visible aria-label

---

## 13. 429 / Rate Limiting

1. Spam the "Generate note" button rapidly (kill throttle in dev or mock the response)
2. App shows an appropriate error (toast or inline) instead of silently failing or crashing

---

## Regression Check After Each Change

- [ ] Login → create encounter → generate note → save → version appears
- [ ] Dark mode toggle persists on refresh
- [ ] Admin can CRUD templates; changes immediately visible to Provider template selector
- [ ] Cancel stream → re-generate works cleanly (no double stream)
