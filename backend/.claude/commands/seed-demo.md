---
description: Seed the database with fictional demo data for walkthrough
---
Seed the local (or staging) database with clearly fictional data — no real patient names, no real
clinical content. Required records:

1. **Two provider accounts**
   - `dr.demo@kyronmedical.test` / password `Demo1234!` — role `provider`
   - `admin@kyronmedical.test` / password `Admin1234!` — role `admin`

2. **Three patients** (MRNs: MRN-001, MRN-002, MRN-003) with DOB and sex populated.

3. **Two encounters** for MRN-001:
   - One finalized with a complete SOAP note and at least one ICD-10 code.
   - One in `draft` status with a transcript but no saved version yet.

4. **One note template** named "General Visit" with placeholder SOAP sections.

Rules:
- Use the application-layer facades (or direct TypeORM repositories if no facade exists yet) — never
  raw SQL inserts that bypass entity validation.
- Print the seeded IDs so they can be used in the walkthrough script.
- Confirm the seed is idempotent: running it twice must not create duplicate records.
