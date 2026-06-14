# Plan — Thino Files v0.7.0: Incremental timeline rendering (infinite scroll)

Source spec: [SPEC.md](../SPEC.md) → **§2.O** (v0.7.0). Decisions (final): infinite
scroll, `BATCH_SIZE = 50`, fixed constant (no setting).

## Problem (confirmed in code)

[`renderList()`](../src/TimelineView.ts) (TimelineView.ts §181–208) calls
`listEl.empty()` then loops **every** visible post into a `PostCard`. At ~422
posts that rebuilds hundreds of DOM subtrees synchronously on every render →
multi-second freeze. Fix: render the newest `BATCH_SIZE` first, reveal more on
scroll, and keep refreshes cheap regardless of total count.

## Constraints carried from the codebase

- **Pure/glue split**: pagination math goes in a new pure `src/pagination.ts`
  (no `obsidian` import) so it is unit-testable under Vitest; DOM/observer code
  stays in `TimelineView.ts` (no unit test — the `obsidian` mock has no layout,
  no scroll metrics, no `IntersectionObserver`).
- **Must not regress** §L (list is the only scroll region), §M (collapsible
  cards — appended cards must inherit it), date-descending order, file format,
  new-post-at-top (AC §2.1), or the debounced disk watcher.
- `TimelineView` has **no `onClose()`** today — one must be added for observer
  teardown (vault listeners are already auto-managed via `registerEvent`).

## Dependency graph

```
pagination.ts (pure)            ← foundation, no deps
   │  initialReveal / growReveal / clampReveal / hasMore / BATCH_SIZE
   ▼
TimelineView: batched render + IntersectionObserver append   (Task 2)
   │  consumes the pure helpers; adds sentinel, observer, onClose, CSS
   ▼
TimelineView: reset-vs-preserve semantics                    (Task 3)
   │  refines the call sites (filter/scope/day = reset; refresh/setFlags = preserve)
   ▼
Verification matrix + green build                            (Task 4)
```

Edges are strict: Task 2 needs Task 1's contract; Task 3 refines Task 2's render
path; Task 4 verifies the whole.

## Slicing rationale (vertical, not horizontal)

- **Task 1** is the one deliberately "pure-layer" slice — justified because the
  project treats pure+tested helpers as standalone modules (see `stats.ts`,
  `filter.ts`) and they are independently verifiable by unit test. It is small
  and de-risks the math before any DOM work.
- **Task 2** is the complete infinite-scroll path end-to-end: newest 50 render →
  scroll reveals the rest → self-fill → stops at the end → observer cleaned up.
  After Task 2 the feature is usable, not a half-built layer.
- **Task 3** is a second complete path: the reset/preserve behavior that keeps a
  deep-scrolled user in place across refreshes and resets on filter changes.
  Split from Task 2 so each is independently demoable and reviewable.
- **Task 4** is the §6 verification matrix + ship-readiness gate.

## Phases & checkpoints

| Phase | Task | Checkpoint (human-verifiable gate) |
|---|---|---|
| 1. Pure foundation | T1 | **CP-A**: `npm test` green; new pagination specs pass |
| 2. Core scroll | T2 | **CP-B**: `npm run build` green; 400+-post dev vault renders ~50, scroll reveals rest in batches, stops at end, no freeze |
| 3. Render semantics | T3 | **CP-C**: filter/scope/day reset to top; archiving a deep-scrolled card keeps position; new post appears at top |
| 4. Ship-ready | T4 | **CP-D**: full §6 matrix passes; `npm test` + `npm run build` green; reopen view ×N leaks no observers |

Stop at each checkpoint for confirmation before starting the next phase.

## Risks & mitigations

- **Self-fill loop (O.5)**: an `IntersectionObserver` callback fires only when
  the intersection *changes*; if the sentinel stays visible after one append it
  may not refire. Mitigation: after each append, if more posts remain and the
  sentinel is still intersecting, schedule another append (rAF) until the
  viewport is filled or posts are exhausted. Guard against infinite loops with
  the `hasMore` terminator.
- **Scroll-offset restore on preserve (O.7)**: `empty()` resets `scrollTop`.
  Save before, restore after; heights may shift slightly after a card is
  removed — "approximately preserved" is acceptable per spec.
- **Observer leaks (O.10)**: create at most one observer; disconnect the old one
  on every full re-render and in `onClose()`.
- **No automated DOM coverage**: mitigated by keeping all branchy math pure
  (Task 1, unit-tested) and a scripted manual matrix (Task 4).

## Out of scope (from §3)

Pagination controls, DOM virtualization, media-grid batching, a "posts per page"
setting, persisted scroll across sessions. No data-model / sort / filter / format
change. No new runtime dependencies.
