# Thino Files v0.2.0 — Implementation Plan

## Context

v0.1.0 ships a flat timeline (one .md file per post, frontmatter `date`/`updated`/`tags`). User wants original-Thino parity features per [SPEC.md](/workspaces/thino/thino-files/SPEC.md):

- **§2.A** Left sidebar: status counters, 12-week heatmap, month calendar (click day = filter)
- **§2.B** Media: configurable assets folder; paste/drop → save binary → insert `![name](path)` link
- **§2.C** Archive + recycle bin via frontmatter flags `archived`/`deleted` (files never move)
- **§2.D** View switch: flat timeline ⇄ folder-grouped (requires recursive `listPosts`)

Constraints: no v0.1.0 regressions, no new runtime deps, pure logic stays `obsidian`-free (vitest runs without the app), vault access through narrow interfaces.

## Dependency graph

```
frontmatter flags ──► flag helpers ──► card actions/scopes ──► scope counts in sidebar
recursive listPosts ──► folder grouping (view mode)
stats.ts (pure) ──► Sidebar (status/heatmap/calendar) ──► calendar day filter
assetsFolder setting ──► saveAsset ──► composer/editor paste-drop
recursive listing must exclude assets folder (T2 before T4)
```

## Tasks (vertical slices, each: code + tests + build green)

### T1 — Archive & recycle bin (SPEC §2.C)

Schema → CRUD → UI in one slice.

- `src/types.ts`: `PostFrontmatter` + `archived?: boolean; deleted?: boolean`
- `src/frontmatter.ts`: `serializePost` emits `archived: true` / `deleted: true` only when true; `parsePost` reads them (absent/false → undefined). Legacy files parse unchanged.
- `src/fileManager.ts`:
  - `buildFlaggedContent(post, flags, now)` (pure — mirrors `buildEditedContent`, bumps `updated`)
  - `setPostFlags(vault: ModifiableVault, post, flags, now?)` → archive/unarchive/restore/soft-delete all go through this
  - keep `deletePost` (vault.trash) — now only used by "Delete forever"
- `src/filter.ts` or new pure fn: `matchScope(post, scope)` where `scope: "timeline" | "archived" | "trash"` (timeline = !archived && !deleted; archived = archived && !deleted; trash = deleted)
- `src/PostCard.ts`: actions vary by scope —
  - timeline: edit / open / **archive** (`archive` icon) / delete (sets `deleted: true`, keeps confirm popover)
  - archived: unarchive / open / delete
  - trash: **restore** / **delete forever** (confirm → existing `deletePost`)
- `src/TimelineView.ts`: `scope` state; temporary header tab strip (Timeline / Archived / Recycle bin + counts) — relocated into sidebar in T3; `renderList` filters by scope then query
- Tests: frontmatter flag round-trip + legacy parse; `buildFlaggedContent` bumps `updated`, preserves `date`/tags/body; `matchScope`; `setPostFlags` via fake vault

**Checkpoint 1**: `npm test` + `npm run build` green; manual: archive/delete/restore cycle in dev vault, old posts unaffected.

### T2 — Recursive listing + folder view mode (SPEC §2.D)

- `src/fileManager.ts`:
  - `isWithinFolder(folder, path)` (any depth); `listPosts` uses it, excluding paths under `normalizeFolder(settings.assetsFolder)` (setting added in T4 — add the setting key now with default `thino/assets` so exclusion is testable; T4 only wires UI)
  - `affectsFolder` → recursive too (watcher catches subfolder edits)
  - `groupByFolder(posts, postsFolder): { name: string; posts: Post[] }[]` (pure) — key = first path segment under posts folder, direct children grouped under the posts folder name; groups alphabetical, posts newest-first (input order)
- `src/types.ts` + `src/settings.ts`: `viewMode: "timeline" | "folders"` (persisted; `mergeSettings` typeof check covers it). No settings-tab row — toggled from view header
- `src/TimelineView.ts`: header segmented toggle (icons `list` / `folder`); folders mode renders collapsible `<details>`-style group headers with counts; session-only collapsed state (Map)
- Filter bar + scope apply in both modes
- Tests: recursive listing, assets-folder exclusion, `affectsFolder` subfolder events, `groupByFolder` keys/sorting

**Checkpoint 2**: tests + build green; manual: posts in `thino/projects/x.md` visible, toggle persists across reload.

### T3 — Sidebar: status, heatmap, calendar (SPEC §2.A)

- `src/stats.ts` (new, pure, no `obsidian` import):
  - `postsPerDay(posts): Map<string /*YYYY-MM-DD local*/, number>` (from `date`, local parts — dates are tz-less local ISO already, so `slice(0,10)` works)
  - `computeStatus(posts): { posts: number; tags: number; days: number }`
  - `heatmapCells(perDay, today, weeks=12)`: 7×12 grid, bucket 0/1–2/3–4/5+
  - `calendarGrid(year, month, perDay)`: weeks of day-cells with counts
- `src/Sidebar.ts` (new, DOM only): status block; heatmap grid with `title` tooltips; month calendar (‹ › nav, dot on active days, click = select/deselect day); scope switcher with counts (moved from T1's header strip); callbacks `onScopeChange(scope)`, `onDaySelect(day | null)`
- `src/TimelineView.ts`: two-column flex layout (`thino-files-layout` > sidebar + main); selected day composes AND with filter-bar query (`visible = scope ∩ query ∩ day`); sidebar refreshed in `refresh()` with non-deleted posts; header toggle button (`panel-left` icon) collapses sidebar, auto-collapse below ~600 px via container width check on `resize` (or CSS container query)
- `styles.css`: layout grid, heatmap cells (4 intensity buckets via `--color-base`/accent opacity), calendar table, narrow-mode rules
- Tests: `stats.ts` fully (counters, bucketing, month grid edges — Jan/Dec rollover, leap Feb)

**Checkpoint 3**: tests + build green; manual: counts correct, day click filters + composes with `#tag` filter, narrow pane collapses sidebar.

### T4 — Media attachments (SPEC §2.B)

- `src/types.ts`/`settings.ts`: surface `assetsFolder` (default `thino/assets`, added in T2) as a settings-tab row
- `src/fileManager.ts`:
  - `buildAssetFilename(date, originalName, exists)` (pure): `YYYYMMDD-HHmmss-{sanitized}.{ext}`, collision `-2`, `-3`…
  - `saveAsset(vault, settings, file: { name, arrayBuffer() })` via narrow interface `{ getAbstractFileByPath, createFolder, createBinary }` → returns vault-relative path
  - `buildMarkdownLink(name, path, isImage)` (pure): `![name](path)` / `[name](path)`; URL-encode spaces in path
- `src/Composer.ts` + `src/PostCard.ts` edit mode: `paste` + `drop` handlers on the textarea → `saveAsset` each file → insert link at cursor (`selectionStart` splice); shared helper `insertAtCursor(textarea, text)`
- Rendering: `MarkdownRenderer` already resolves vault-relative `![](path)` — verify only
- Tests: asset filename building/collisions, link building (image vs file, space encoding), `saveAsset` never-overwrite via fake vault, `insertAtCursor`

**Checkpoint 4 (final)**: full suite + build; manual in dev vault: paste screenshot → renders on card; drop PDF → clickable link; README + SPEC cross-check of all ACs.

## Files touched

| File | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| types.ts | ✓ | ✓ | | ✓ |
| frontmatter.ts | ✓ | | | |
| fileManager.ts | ✓ | ✓ | | ✓ |
| filter.ts | ✓ | | | |
| PostCard.ts | ✓ | | | ✓ |
| TimelineView.ts | ✓ | ✓ | ✓ | |
| Composer.ts | | | | ✓ |
| settings.ts | | ✓ | | ✓ |
| stats.ts (new) | | | ✓ | |
| Sidebar.ts (new) | | | ✓ | |
| styles.css | ✓ | ✓ | ✓ | ✓ |
| tests/* | ✓ | ✓ | ✓ | ✓ |

## Reuse (no new code where existing fits)

- `serializePost`/`parsePost` extension — not a new parser
- `buildEditedContent` pattern for `buildFlaggedContent`; `updatePost` pattern for `setPostFlags`
- `buildFilename` collision-probe pattern for `buildAssetFilename`
- `sanitizeSlug` for asset name sanitizing; `formatDate` for timestamps
- Narrow-vault-interface + fake-in-tests pattern from `tests/mocks/obsidian.ts`
- `PostCard.addAction` for new card buttons; confirm-popover pattern for delete-forever

## Verification

Per checkpoint: `npm test` (vitest, pure logic) + `npm run build` (tsc strict + esbuild). Manual UI passes in a dev vault per checkpoint notes above. Final: walk SPEC §2.A–D acceptance criteria one by one.

## Deliverables on build start

First build step writes `tasks/plan.md` (this plan) and `tasks/todo.md` (T1–T4 checklist with ACs) — deferred now because plan mode forbids repo writes.
