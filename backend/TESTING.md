# Backend Manual Testing Checklist

Base URL: `http://localhost:3000`

**Setup** — stack must be running:
```bash
docker compose up -d
# Seed demo users (run once):
docker exec ai-clinical-scribe-api-1 node dist/contexts/identity/seed/seed.js
```

---

## 0. Health

- [ ] `GET /health` → `{"status":"ok","db":"up"}`

```bash
curl http://localhost:3000/health
```

---

## 1. Auth

### 1.1 Login — provider
- [ ] Returns `accessToken`

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dr.alice@demo.clinic","password":"DemoPass1!"}' | jq .
```

Save the token:
```bash
PROVIDER_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dr.alice@demo.clinic","password":"DemoPass1!"}' | jq -r .accessToken)
```

### 1.2 Login — admin
```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.clinic","password":"AdminPass1!"}' | jq -r .accessToken)
```

### 1.3 GET /auth/me — valid token
- [ ] Returns `id`, `email`, `role`, `firstName`, `lastName`

```bash
curl -s http://localhost:3000/auth/me \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq .
```

### 1.4 GET /auth/me — no token
- [ ] Returns `401`

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/auth/me
```

### 1.5 POST /auth/login — wrong password
- [ ] Returns `401`

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dr.alice@demo.clinic","password":"wrong"}'
```

### 1.6 Rate limit — 6th login attempt
- [ ] 6th request returns `429`

```bash
for i in {1..6}; do
  curl -s -o /dev/null -w "req $i: %{http_code}\n" -X POST http://localhost:3000/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"dr.alice@demo.clinic","password":"wrong"}'
done
```

---

## 2. Encounters

### 2.1 Create encounter (with optional inline transcript)
- [ ] Returns `201` with `id`, `status: "draft"`, `patientId`

```bash
ENC=$(curl -s -X POST http://localhost:3000/encounters \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "dateOfBirth": "1975-03-22",
    "transcript": "Patient presents with chest pain and shortness of breath for two days. No fever. History of hypertension."
  }')
echo $ENC | jq .
ENC_ID=$(echo $ENC | jq -r .id)
```

### 2.1b Set transcript separately (PATCH)
- [ ] Returns `{"ok":true}`

```bash
curl -s -X PATCH http://localhost:3000/encounters/$ENC_ID/transcript \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Patient presents with chest pain x2 days, no fever, history of hypertension."}' | jq .
```

### 2.2 Create encounter — missing required fields
- [ ] Returns `400`

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/encounters \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### 2.3 Create encounter — admin token (wrong role)
- [ ] Returns `403`

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/encounters \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Jane","lastName":"Smith","dateOfBirth":"1975-03-22"}'
```

### 2.4 List encounters
- [ ] Returns array containing the created encounter

```bash
curl -s http://localhost:3000/encounters \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq .
```

### 2.5 Get encounter by ID
- [ ] Returns single encounter with transcript

```bash
curl -s http://localhost:3000/encounters/$ENC_ID \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq .
```

### 2.6 Get encounter — wrong provider (cross-tenant isolation)
- [ ] Returns `404` (Bob cannot see Alice's encounter)

```bash
BOB_TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dr.bob@demo.clinic","password":"DemoPass2!"}' | jq -r .accessToken)

curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/encounters/$ENC_ID \
  -H "Authorization: Bearer $BOB_TOKEN"
```

### 2.7 Patch working draft
> Must run before 2.8 — draft patching is only allowed while status is `draft`.

- [ ] Returns `{"ok":true}`

```bash
curl -s -X PATCH http://localhost:3000/encounters/$ENC_ID/draft \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "draft": {
      "subjective": "Patient reports chest pain",
      "objective": "BP 150/90, HR 88",
      "assessment": {"text": "Hypertensive urgency", "icd10": []},
      "plan": "Start amlodipine 5mg, follow up in 1 week"
    }
  }' | jq .
```

### 2.8 Save note version (v1)
> First save transitions encounter status `draft → finalized`. Subsequent version saves still work.

- [ ] Returns `201` with `versionNo: 1`

```bash
curl -s -X POST http://localhost:3000/encounters/$ENC_ID/notes \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "soapNote": {
      "subjective": "Patient reports chest pain x2 days",
      "objective": "BP 150/90, HR 88, afebrile",
      "assessment": {
        "text": "Hypertensive urgency",
        "icd10": [{"code": "I10", "description": "Essential (primary) hypertension"}]
      },
      "plan": "Start amlodipine 5mg daily, low-sodium diet, follow up 1 week"
    }
  }' | jq .
```

### 2.9 Save second version (v2)
> Same `$ENC_ID` — encounter is now finalized but additional versions can still be appended.

- [ ] Returns `versionNo: 2`

```bash
curl -s -X POST http://localhost:3000/encounters/$ENC_ID/notes \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "soapNote": {
      "subjective": "Patient reports chest pain x2 days, denies fever",
      "objective": "BP 148/88, HR 82, SpO2 98%",
      "assessment": {
        "text": "Hypertensive urgency, rule out ACS",
        "icd10": [
          {"code": "I10", "description": "Essential (primary) hypertension"},
          {"code": "R07.9", "description": "Chest pain, unspecified"}
        ]
      },
      "plan": "EKG, troponin, start amlodipine 5mg, follow up 48h"
    }
  }' | jq .
```

### 2.10 List versions
- [ ] Returns array of 2 versions

```bash
curl -s http://localhost:3000/encounters/$ENC_ID/versions \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq .
```

### 2.11 Get specific version
- [ ] Returns version 1

```bash
curl -s http://localhost:3000/encounters/$ENC_ID/versions/1 \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq .
```

### 2.12 Diff versions (pioneer feature)
- [ ] Returns `diff` object showing what changed between v1 and v2

```bash
curl -s "http://localhost:3000/encounters/$ENC_ID/versions/diff?from=1&to=2" \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq .
```

---

## 3. Scribe — SSE Generation

> Generate only works on encounters in `draft` status. The encounter from section 2 is already
> finalized (note was saved in 2.8), so create a fresh one here.
>
> Requires `ANTHROPIC_API_KEY` set in `.env`. Without it the LLM provider will error.

```bash
# Fresh draft encounter with transcript for generation tests
GEN_ENC=$(curl -s -X POST http://localhost:3000/encounters \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1968-11-05",
    "transcript": "Patient is a 57-year-old male presenting with substernal chest pain radiating to the left arm, onset 2 hours ago. Associated diaphoresis and shortness of breath. History of hypertension and type 2 diabetes. Current medications: metformin 1000mg BID, lisinopril 10mg daily. BP 160/100, HR 96, RR 20, SpO2 95% on room air. EKG shows ST elevation in leads II, III, aVF."
  }')
GEN_ENC_ID=$(echo $GEN_ENC | jq -r .id)
echo "Generation encounter: $GEN_ENC_ID"
```

### 3.1 Generate SOAP note (SSE stream)
- [ ] Response `Content-Type` is `text/event-stream`
- [ ] Events arrive line by line as `data: {...}`
- [ ] Stream ends with `{"type":"done"}`

```bash
curl -s -N -X POST http://localhost:3000/encounters/$GEN_ENC_ID/generate \
  -H "Authorization: Bearer $PROVIDER_TOKEN"
```

### 3.2 Refused — empty transcript
- [ ] Returns SSE event `{"type":"refused","reason":"..."}`

```bash
EMPTY_ENC=$(curl -s -X POST http://localhost:3000/encounters \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Test","lastName":"Patient","dateOfBirth":"1990-01-01"}' | jq -r .id)

curl -s -N -X POST http://localhost:3000/encounters/$EMPTY_ENC/generate \
  -H "Authorization: Bearer $PROVIDER_TOKEN"
```

### 3.3 Expired/invalid token during generate
- [ ] Returns `401`

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/encounters/$GEN_ENC_ID/generate \
  -H "Authorization: Bearer bad.token.here"
```

---

## 4. Templates

### 4.1 Create template — admin only
- [ ] Returns `201` with `id`, `isActive: false`

```bash
TMPL=$(curl -s -X POST http://localhost:3000/templates \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "General Visit",
    "encounterType": "general",
    "promptBody": "Generate a SOAP note for a general outpatient visit."
  }')
echo $TMPL | jq .
TMPL_ID=$(echo $TMPL | jq -r .id)
```

### 4.2 Create template — provider (wrong role)
- [ ] Returns `403`

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/templates \
  -H "Authorization: Bearer $PROVIDER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","promptBody":"..."}'
```

### 4.3 List templates — admin sees all (including inactive)
- [ ] Returns array including the new template

```bash
curl -s http://localhost:3000/templates \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 4.4 List templates — provider sees only active
- [ ] Returns empty array (template is not yet active)

```bash
curl -s http://localhost:3000/templates \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq 'length'
```

### 4.5 Update template (activate it)
- [ ] Returns updated template with `isActive: true`

```bash
curl -s -X PUT http://localhost:3000/templates/$TMPL_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "General Visit",
    "encounterType": "general",
    "promptBody": "Generate a SOAP note for a general outpatient visit.",
    "isActive": true
  }' | jq .
```

### 4.6 List templates — provider now sees it
- [ ] Returns array with 1 template

```bash
curl -s http://localhost:3000/templates \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq .
```

### 4.7 Delete template
- [ ] Returns `204`

```bash
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:3000/templates/$TMPL_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 5. ICD-10 Search

> Requires pgvector extension and populated embeddings. Returns empty array if embeddings not seeded.

### 5.1 Search — valid query
- [ ] Returns array (may be empty if not seeded; no 5xx)

```bash
curl -s "http://localhost:3000/icd10/search?q=hypertension" \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq .
```

### 5.2 Search — missing query param
- [ ] Returns `400`

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/icd10/search" \
  -H "Authorization: Bearer $PROVIDER_TOKEN"
```

### 5.3 Search — unauthenticated
- [ ] Returns `401`

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/icd10/search?q=diabetes"
```

---

## 6. Admin

### 6.1 Create provider
- [ ] Returns `201` with `role: "provider"`

```bash
NEW_PROVIDER=$(curl -s -X POST http://localhost:3000/admin/providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "dr.new@demo.clinic",
    "firstName": "New",
    "lastName": "Provider",
    "password": "TempPass1!"
  }')
echo $NEW_PROVIDER | jq .
NEW_PROVIDER_ID=$(echo $NEW_PROVIDER | jq -r .id)
```

### 6.2 New provider can log in
- [ ] Returns `accessToken`

```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dr.new@demo.clinic","password":"TempPass1!"}' | jq .
```

### 6.3 List providers
- [ ] Returns array including the new provider

```bash
curl -s http://localhost:3000/admin/providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 6.4 List encounters (admin view, cross-provider)
- [ ] Returns encounters from all providers

```bash
curl -s http://localhost:3000/admin/encounters \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 6.5 Filter encounters by providerId
- [ ] Returns only that provider's encounters

```bash
ALICE_ID=$(curl -s http://localhost:3000/auth/me \
  -H "Authorization: Bearer $PROVIDER_TOKEN" | jq -r .id)

curl -s "http://localhost:3000/admin/encounters?providerId=$ALICE_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 6.6 Deactivate provider
- [ ] Returns `{"ok":true}`

```bash
curl -s -X PATCH http://localhost:3000/admin/providers/$NEW_PROVIDER_ID/deactivate \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

### 6.7 Admin endpoints — provider token (wrong role)
- [ ] Returns `403`

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/admin/providers \
  -H "Authorization: Bearer $PROVIDER_TOKEN"
```

---

## 7. Security / Edge Cases

### 7.1 Global rate limit — not hit under normal load
- [ ] First request to any endpoint succeeds with `200`/`201`

### 7.2 Helmet headers present
- [ ] Response includes `X-Content-Type-Options`, `X-Frame-Options`

```bash
curl -sI http://localhost:3000/health | grep -i "x-content-type\|x-frame\|content-security"
```

### 7.3 Invalid JWT signature
- [ ] Returns `401`

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJmYWtlIn0.invalidsignature"
```

### 7.4 Malformed JSON body
- [ ] Returns `400`

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d 'not json'
```
