---
description: Audit a streaming UI implementation for correctness
argument-hint: <component-name>
---
Check `$1` for: uses fetch+ReadableStream (not EventSource), wires an AbortController that aborts
on unmount/patient-switch/explicit cancel, doesn't set state after unmount, and doesn't let a
second generate call race the first without cancelling it.
