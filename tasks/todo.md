# TODO — Thino Files v0.7.0 (infinite scroll, §2.O)

Plan: [plan.md](plan.md) · Spec: [SPEC.md](../SPEC.md) §2.O

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 1 — Pure pagination foundation

### T1 — `src/pagination.ts` + `tests/pagination.test.ts`  `[x]`
Covers AC O.1 (batch size), O.7 (clamp), O.11 (fixed constant).

- [ ] Create `src/pagination.ts` (no `obsidian` import):
  - `export const BATCH_SIZE = 50;`
  - `initialReveal(total)` → `Math.min(total, BATCH_SIZE)`
  - `growReveal(revealed, total)` → `Math.min(revealed + BATCH_SIZE, total)`
  - `clampReveal(revealed, total)` → `Math.min(Math.max(revealed, BATCH_SIZE), total)`
  - `hasMore(revealed, total)` → `revealed < total`
- [ ] Create `tests/pagination.test.ts` covering:
  - `initialReveal`: total `< / = / >` `BATCH_SIZE`; total `0`
  - `growReveal`: grows by batch, saturates at `total`, never exceeds it
  - `clampReveal`: result is `≥ BATCH_SIZE` (when total allows) and `≤ total`; total `< BATCH_SIZE` → `total`
  - `hasMore`: `0`, mid, `revealed === total` (false)

**AC**: helpers are pure, exported, typed; values match the formulas above.
**Verify**: `npm test` → new specs pass.

> **CP-A** — `npm test` green. Stop for confirmation.

---

## Phase 2 — Core infinite scroll

### T2 — Batched render + IntersectionObserver append  `[x]`
Covers AC O.1–O.5, O.9, O.10. Complete usable scroll path.

- [ ] Add fields to `TimelineView`: `private revealed = 0;`,
  `private observer: IntersectionObserver | null = null;`
- [ ] Import `BATCH_SIZE, initialReveal, growReveal, hasMore` from `./pagination`.
- [ ] `renderList()`: after computing `visible`, set
  `this.revealed = initialReveal(visible.length)` (reset default — preserve added
  in T3), render only `visible.slice(0, this.revealed)` as cards.
- [ ] When `hasMore(this.revealed, visible.length)`: append a
  `.thino-files-sentinel` div after the last card and (re)install the observer —
  `disconnectObserver()` first, then a new `IntersectionObserver` rooted on
  `this.listEl` with a `rootMargin` (e.g. `200px`) observing the sentinel.
- [ ] `appendBatch(visible)`: `this.revealed = growReveal(this.revealed, visible.length)`;
  create only the new slice's cards **before** the sentinel (no `empty()`/rebuild);
  self-fill — if `hasMore` and sentinel still intersecting, schedule another
  append via `requestAnimationFrame`; when `!hasMore`, remove sentinel +
  `disconnectObserver()`.
- [ ] Hold the current `visible` list for the observer callback (recompute or
  cache) so `appendBatch` slices the same filtered array.
- [ ] Add `private disconnectObserver()` and call it before re-creating.
- [ ] Add `async onClose()` that calls `disconnectObserver()`.
- [ ] Empty/media/short-list paths (`visible.length < BATCH_SIZE`) install no
  observer and no sentinel (O.9).
- [ ] `styles.css`: `.thino-files-sentinel` minimal-height marker; must not
  disturb §L scroll or §M layout (optional subtle "loading…" affordance).

**AC**: O.1 newest ≤50 first; O.2 scroll appends without rebuilding shown cards
(their §M expand state survives); O.3 stops at end; O.4 observer-based, no scroll
polling; O.5 self-fills; O.9 no sentinel when under a batch; O.10 no leaks.
**Verify**: `npm run build` green; dev vault with **400+ posts** — initial render
~50 and responsive (no freeze); scroll reveals batches to the end then stops;
filter to `<50` results → no sentinel.

> **CP-B** — build green + manual smoke on a large vault. Stop for confirmation.

---

## Phase 3 — Reset vs preserve semantics

### T3 — Render-state semantics + scroll-offset restore  `[x]`
Covers AC O.6, O.7, O.8.

- [ ] Give render a mode: `renderList(opts?: { preserve?: boolean })`.
  - **reset** (default): `this.revealed = initialReveal(visible.length)`;
    `this.listEl.scrollTop = 0`.
  - **preserve**: `this.revealed = clampReveal(this.revealed, visible.length)`;
    save `listEl.scrollTop` before `empty()`, restore it after rebuild.
- [ ] Call sites:
  - reset (default): scope change (§86), day select (§90), filter query (§124)
  - preserve: `refresh()` (§168) and `setFlags` card action (§269) →
    `renderList({ preserve: true })`
- [ ] Verify new-post path: composer → `createPost` → `refresh()` still shows the
  new post at the top (AC O.8 / §2.1) — preserve must not scroll past it.

**AC**: O.6 filter/scope/day reset to newest 50 at top with a fresh observer;
O.7 refresh/setFlags keep `clampReveal(...)` cards and restore scroll; O.8 new
post stays visible at top.
**Verify**: dev vault — (a) scroll deep, change scope → back to top, 50 cards;
(b) scroll deep, archive a card → list stays at position (no jump to top);
(c) post a new note → it appears at the top.

> **CP-C** — manual semantics check. Stop for confirmation.

---

## Phase 4 — Ship-readiness

### T4 — Full verification matrix + green gate  `[~]`
Covers SPEC §6.

- [x] Automatable gate: `npm test` (133 passed) + `npm run build` green; strict
  typecheck; all `./pagination` imports used; no dangling imports.
- [ ] **(User — needs the Obsidian app)** Run the §6 manual matrix (a–h) on a 400+-post dev vault:
  a) ~50 initial, responsive; b) scroll appends to end then stops;
  c) filtered `<50` → no sentinel; d) filter/scope/day reset to top;
  e) archive/delete deep card keeps position; f) new post at top;
  g) §M expand state of shown cards survives appends;
  h) close/reopen the view ×N → no leaked observers (no growth, no double-fires).
- [ ] `npm test` green (incl. T1 specs); `npm run build` green; strict typecheck;
  no dangling imports.

**AC**: all §6 items pass; both commands green.
**Verify**: paste command output + matrix results.

> **CP-D** — final go/no-go. Stop for confirmation.

---

## Not doing (from §3)
Pagination controls · DOM virtualization · media-grid batching · "posts per page"
setting · persisted cross-session scroll · any data-model/sort/filter/format
change · new runtime deps.
