---
description: Review the current diff against this project's tiered-DDD rules
---
Review the pending diff (`git diff`) against CLAUDE.md's architecture rules specifically:
1. Does any full-hexagonal context (encounter, scribe) leak a framework or ORM type into domain?
2. Does any change violate the cross-context import rule?
3. Does anything touch `note_versions` with an UPDATE or DELETE?
4. Is there a new per-request DB connection instead of the pooled DataSource?
5. Any secret added directly instead of via AwsSecretsLoader?
Report findings as a pass/fail checklist, not prose.
