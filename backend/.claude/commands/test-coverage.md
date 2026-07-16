---
description: Run coverage and surface uncovered critical paths
---
Run `pnpm run test:cov`. After the report, highlight:

1. **Uncovered use cases** — any class in `*/application/use-cases/` with < 80% branch coverage.
2. **Uncovered guardrails** — `OutputGuardrail` implementations must be 100% branch-covered; flag
   any branch that isn't.
3. **Uncovered repository adapters** — TypeORM repository methods (especially the append-only
   `note_versions` path) below 70% line coverage.
4. **Missing edge-case tests** — check whether these scenarios have a test:
   - Non-clinical transcript rejected before any LLM call.
   - Expired JWT returning 401 with no data loss.
   - Duplicate `(encounter_id, version_no)` insert rejected.
   - Ownership mismatch returning 403 not 404 (don't leak existence).

Report as a table: path | line% | branch% | missing scenarios.
