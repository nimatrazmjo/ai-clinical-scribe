---
description: Run tsc and explain every type error in context
---
Run `tsc -b` from the frontend root. For each error:
- Show file path and line number.
- Quote the failing line.
- Explain why it fails — missing type, structural mismatch, stale import from `@scribe/contracts`, etc.
- Suggest the minimal fix. Do not suggest `as any` or `// @ts-ignore` unless there is no typed
  alternative; justify the exception if you must use one.

After all errors: confirm that every API response type comes from `@scribe/contracts` and is not
hand-rolled as a local interface. Flag any duplicate type that should be deleted in favour of the
contract import.
