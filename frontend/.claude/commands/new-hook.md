---
description: Scaffold a new custom hook with cleanup handled correctly
argument-hint: <hook-name>
---
Create hook `$1`. If it involves an async subscription, fetch, or stream, wire an
`AbortController`/cleanup function in `useEffect`'s return so it cancels on unmount or dependency
change. If it consumes server data, prefer wrapping React Query over hand-rolled state.
