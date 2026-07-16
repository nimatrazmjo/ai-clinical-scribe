---
description: Performance and bundle audit for the clinical UI
---
Run `pnpm run build` and review the output. Report:

1. **Bundle size** — total JS payload after gzip (target < 200 KB initial). List the top 5 largest
   chunks by name and size. Flag anything over 50 KB that could be lazy-loaded.
2. **Lazy loading** — are routes for `admin-templates` and `version-diff` code-split? They should
   not be in the initial bundle a provider loads.
3. **React Query caching** — confirm `staleTime` is set on encounter and patient queries (not 0),
   so a provider navigating back doesn't re-fetch on every keystroke.
4. **Excessive re-renders** — in the streaming SOAP editor, confirm the token buffer updates do not
   re-render the entire page. The streaming buffer should be isolated state in the generation hook,
   not lifted to app root.
5. **Memoization** — `useSoapStream` and `useDraftAutosave` should be stable references. Flag any
   hook that creates a new object/function on every render that gets passed as a dep array entry.
6. **Image assets** — `hero.png` and any other raster images should be removed or replaced with
   SVG/CSS if they shipped in from the scaffold. Clinical UI needs no decorative images.
