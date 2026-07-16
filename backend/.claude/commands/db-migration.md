---
description: Generate and review a TypeORM migration
argument-hint: <migration-name>
---
Generate a TypeORM migration named `$1`. Check it against these rules before finishing:
- Any `note_versions` change must preserve append-only semantics — no UPDATE/DELETE path.
- New foreign keys get an index if they'll be filtered/joined on.
- No migration may hardcode a credential or connection string.
Show the generated SQL and explain each statement before I approve it.
