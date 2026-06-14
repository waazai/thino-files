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

---

# Thino Files v0.3.0 — Implementation Plan

## Context

v0.2.0 shipped (sidebar, media attach, archive/recycle, timeline⇄folder). User
wants three additions per [SPEC.md](/workspaces/thino/thino-files/SPEC.md)
§2.E–§2.G:

- **§2.E** Small gap between filter bar and first post (CSS only).
- **§2.F** A **Media** sidebar scope showing a grid of images embedded in posts.
- **§2.G** Multiple configurable source folders, exactly one active at a time,
  switched from config.

Constraints unchanged: no v0.2.0 regression, no new runtime deps, pure logic
stays `obsidian`-free, vault access through narrow interfaces.

## Dependency graph

```
[T5] .thino-files-filterbar gap ── pure CSS, independent, ship first

extractImageEmbeds (media-grid.ts, pure) ─┐
PostScope "media" + matchScope ───────────┼─► Sidebar media scope row ─► TimelineView grid render
                                          └► (resolve linkpath → getResourcePath → <img>, click → openPost)   [T6]

sourceFolders[] in types ─► mergeSettings (array-guard + legacy seed + active∈list) ─► settings UI (list + active picker)
                                                                                     └► TimelineView toolbar switcher (optional, same setting)   [T7]
```

`postsFolder` is **redefined as "the active source folder"** — a single string,
unchanged in shape — so `listPosts` / `createPost` / `saveAsset` / `watchVault`
need **zero** edits. T5 / T6 / T7 are mutually independent; sequence is just
smallest-blast-radius first.

## Tasks (vertical slices, each: code + tests where logic + build green)

### T5 — Filter-bar / list spacing (SPEC §2.E)

- `styles.css`: `.thino-files-filterbar { margin-bottom: var(--size-4-2); }`
  (gap sits below the input and below committed chips, so neither touches the
  first card — AC E.1). No DOM/TS changes (AC E.2).
- Tests: none (pure CSS).

**Checkpoint 5**: `npm run build` green; manual — visible gap between search box
and first post, and with chips present.

### T6 — Media grid scope (SPEC §2.F)

Pure extraction → scope plumbing → grid render, one slice.

- `src/media-grid.ts` (new, pure, no `obsidian` import): `extractImageEmbeds(body): string[]`
  — match Markdown `![alt](target)` and wiki `![[target]]`, keep only image
  extensions (`png jpg jpeg gif webp svg avif bmp`), strip `|alias`/`#anchor`
  and surrounding spaces from wiki targets, preserve appearance order; one entry
  per occurrence (AC F.2, F.5, F.7).
- `src/filter.ts`: add `"media"` to `PostScope`; `matchScope(post, "media")`
  qualifies the same posts as `"timeline"` (`!archived && !deleted`) — AC F.3.
- `src/Sidebar.ts`: add a **Media** scope row (icon `image`); its count = total
  image embeds across the media-scope posts (sum of `extractImageEmbeds` over
  non-deleted active posts).
- `src/TimelineView.ts`: when `listScope === "media"`, render a grid instead of
  the card list and hide the timeline/folders view-mode toggle (AC F.1). For
  each visible post (scope ∩ query ∩ selectedDay), for each embed →
  tile: resolve `app.metadataCache.getFirstLinkpathDest(linkpath, post.path)`,
  `vault.getResourcePath(file)` → `<img>`; click → `openPost(post)`; `title` =
  post date (AC F.4). Posts already sorted newest-first; embeds in body order
  (AC F.5). Empty → "No media yet." (AC F.6). Unresolvable embeds are skipped.
- `styles.css`: `.thino-files-media-grid` (`repeat(auto-fill, minmax(120px,1fr))`)
  + square-ish `object-fit: cover` tiles, hover affordance.
- Tests (`tests/mediaGrid.test.ts`): `extractImageEmbeds` — md image, wiki embed,
  multiple-per-body order, ignores non-image links / bare text / `[[note]]`
  links, handles spaces + subfolder paths, strips alias/anchor; `matchScope`
  `"media"` == `"timeline"` qualification.

**Checkpoint 6**: tests + build green; manual — Media scope shows a grid, tile
click opens the source post, filter bar + calendar day narrow the grid.

### T7 — Multiple source folders, one active (SPEC §2.G)

- `src/types.ts`: `ThinoFilesSettings` gains `sourceFolders: string[]`; default
  `["thino"]`. `postsFolder` documented as **the active folder** (default
  `"thino"`); shape unchanged.
- `src/settings.ts`:
  - `mergeSettings` — **special-case `sourceFolders` before the typeof loop**
    (a non-array object would pass the existing `typeof === "object"` check):
    accept only `Array.isArray` of non-empty strings, else default; **legacy
    seed** — if stored has a `postsFolder` string and no valid `sourceFolders`,
    set `sourceFolders = [postsFolder]`; finally **reconcile invariant** — if
    `postsFolder ∉ sourceFolders`, set `postsFolder = sourceFolders[0]`; empty
    list → default `["thino"]` (AC G.1, G.4).
  - UI — replace the single "Posts folder" text row with: an editable **Source
    folders** list (per-row text + remove, plus an "Add folder" button) and an
    **Active source folder** dropdown over `sourceFolders` writing
    `settings.postsFolder`; both `saveSettings()` + `refreshTimelines()`
    (AC G.1, G.2). Keep the Assets-folder row and others as-is.
- `src/TimelineView.ts` (AC G.5): a compact source `<select>` in the toolbar
  listing `sourceFolders`, value = active `postsFolder`; on change set
  `settings.postsFolder`, save, `refresh()`. Same single source of truth as the
  settings picker. Rebuilt whenever the view refreshes.
- No watcher change: `watchVault`'s `onChange` reads
  `this.plugin.settings.postsFolder` at event time, so the active folder is
  tracked automatically (AC G.3). `main.refreshTimelines()` already re-reads.
- Tests (`tests/settings.test.ts`): legacy `{postsFolder:"x"}` → `sourceFolders:["x"]`,
  active `"x"`; non-array `sourceFolders` rejected → default; `postsFolder` not
  in list reconciled to `sourceFolders[0]`; empty list → `["thino"]`; array with
  non-string entries rejected.

**Checkpoint 7 (final)**: full suite + build green; manual in dev vault — add a
2nd source folder, switch active (settings + toolbar), only its posts show and
the choice persists across reload; posting + asset paste still work; a legacy
`data.json` migrates. Bump `manifest.json`/`package.json` version + README;
walk SPEC §2.E–§2.G acceptance criteria.

## Files touched (v0.3.0)

| File | T5 | T6 | T7 |
|---|---|---|---|
| styles.css | ✓ | ✓ | |
| media-grid.ts (new) | | ✓ | |
| filter.ts | | ✓ | |
| Sidebar.ts | | ✓ | |
| TimelineView.ts | | ✓ | ✓ |
| types.ts | | | ✓ |
| settings.ts | | | ✓ |
| tests/* | | ✓ | ✓ |

## Reuse (no new code where existing fits)

- Scope plumbing: `PostScope` union + `matchScope` + Sidebar scope-row loop —
  "media" is one more entry, render branch in `TimelineView.renderList`.
- `openPost` (AC §2.5) reused verbatim for tile clicks.
- Settings dropdown via `Setting.addDropdown`; list rows follow existing
  `new Setting(containerEl).addText(...)` pattern; `refreshTimelines` exists.
- Narrow-vault + fake-in-tests pattern (`tests/mocks/obsidian.ts`) for any
  vault-touching test; extraction + settings merge are pure (no fake needed).

## Verification

Per checkpoint: `npm test` (vitest, pure logic) + `npm run build` (tsc strict +
esbuild). Manual UI passes per checkpoint notes. Final: walk SPEC §2.E–§2.G.

---

# Thino Files v0.4.0 — Implementation Plan

## Context

v0.3.0 shipped (media grid, multi-source, spacing). v0.4.0 is a UX
simplification per [SPEC.md](/workspaces/thino/thino-files/SPEC.md) §2.H–§2.I:

- **§2.H** Remove the timeline/folder view toggle and **all** folder-grouping
  code — flat timeline becomes the only view. Recursion is retained.
- **§2.I** Move source switching into the **sidebar** (a dropdown above the
  stats), replacing the v0.3.0 toolbar switcher.

(Asset rework §2.J/§2.K split to v0.5.0 — planned separately.)

Constraints: no non-folder-view regression, no new deps, recursion stays, dead
code removed outright (no commented-out blocks).

## Dependency graph

```
[T8] remove folder view ── types(viewMode) + fileManager(groupByFolder) + TimelineView(toggle/groups) + styles + tests
        │  (clears viewToggle from the toolbar, leaves the v0.3.0 source switcher there for now)
        ▼
[T9] source dropdown → sidebar ── TimelineView(drop toolbar switcher, wire onSourceChange, pass folders to update)
                                   + Sidebar(sourceEl above stats) + styles
```

T8 before T9: both edit `TimelineView.ts`; T8 strips the toggle, T9 then strips
the toolbar source switcher and adds the sidebar one. Sequential, not parallel.

## Tasks (vertical slices, each: code + tests where logic + build green)

### T8 — Remove folder view (SPEC §2.H)

Pure removal; the only "test" is the suite staying green minus the dropped
grouping tests, plus a clean grep.

- `src/types.ts`: delete `ViewMode` type, `viewMode` field, and its default.
- `src/fileManager.ts`: delete `groupByFolder` + `PostGroup`. **Keep**
  `isWithinFolder`, recursive `listPosts`, `affectsFolder`.
- `src/TimelineView.ts`: remove the `groupByFolder`/`ViewMode` imports,
  `viewToggleEl` field + creation, `renderViewToggle`, `renderGroups`,
  `collapsedGroups`, the `viewMode === "folders"` branch in `renderList`, and
  the `this.viewToggleEl.toggle(...)` line in `onScopeChange`. (Leave the
  toolbar source switcher — removed in T9.)
- `styles.css`: remove `.thino-files-viewtoggle*` and `.thino-files-group*`.
- `tests/folderView.test.ts`: drop the `groupByFolder` describe + the
  `groupByFolder` import; keep `isWithinFolder`/recursive-listing/`affectsFolder`.
- AC H.4: confirm `mergeSettings` still drops a stale `viewMode` key (generic
  unknown-key handling already covers it — no code needed; spot-check by hand).

**Checkpoint 8**: `npm test` + `npm run build` green; `grep -Rn
'viewMode\|ViewMode\|groupByFolder\|PostGroup\|renderGroups\|collapsedGroups\|viewtoggle\|thino-files-group' src styles.css`
returns nothing; timeline still shows subfolder posts flat.

### T9 — Source dropdown in the sidebar (SPEC §2.I)

- `src/Sidebar.ts`: create `sourceEl` **before** `statusEl` in the constructor.
  Add `onSourceChange: (folder: string) => void` to `SidebarCallbacks`. Extend
  `update(posts, scope, sourceFolders, activeFolder)` and render a labeled
  `<select>` (always shown, even with one folder; AC I.2) whose value =
  `activeFolder`; `change` → `onSourceChange(value)`.
- `src/TimelineView.ts`: delete `sourceSwitcherEl` + `renderSourceSwitcher` and
  their toolbar creation/`refresh()` call. Wire `onSourceChange` in the Sidebar
  construction → set `settings.postsFolder`, `saveSettings()`, `refresh()`.
  Update **all** `this.sidebar.update(...)` call sites to pass
  `this.plugin.settings.sourceFolders` + `this.plugin.settings.postsFolder`.
- `styles.css`: small `.thino-files-source` selector style (full-width select,
  bottom margin above the stats).
- No new unit tests (DOM only). Manual: dropdown above stats, lists configured
  folders, switching reloads timeline + stats for the new source; settings-tab
  Active-source picker stays in sync (AC I.3, I.4).

**Checkpoint 9 (final)**: tests + build green; manual in dev vault — sidebar
dropdown switches source, no toolbar switcher remains, settings picker agrees.
Bump version + README (drop folder-view + toolbar-switcher mentions, document
the sidebar source dropdown); walk SPEC §2.H–§2.I.

## Files touched (v0.4.0)

| File | T8 | T9 |
|---|---|---|
| types.ts | ✓ | |
| fileManager.ts | ✓ | |
| TimelineView.ts | ✓ | ✓ |
| Sidebar.ts | | ✓ |
| styles.css | ✓ | ✓ |
| tests/folderView.test.ts | ✓ | |

## Verification

Per checkpoint: `npm test` + `npm run build`. T8 also a removal grep. Manual UI
per checkpoint. Final: walk SPEC §2.H–§2.I.

---

# Thino Files v0.5.0 — Implementation Plan

## Context

Asset rework split out of v0.4.0, per [SPEC.md](/workspaces/thino/thino-files/SPEC.md)
§2.J–§2.K:

- **§2.J** Co-locate assets: store pasted/dropped media in an `assets` subfolder
  *inside the active source folder* (was one global `assetsFolder`).
- **§2.K** Manual, confirm-gated **Clean orphaned assets** sweep (never auto).

Constraints: no v0.4.0 regression, no new deps, pure scan logic stays
`obsidian`-free, every deletion is user-triggered + confirmed + `vault.trash`.

## Dependency graph

```
[T10] co-located assets ── types(assetsSubfolder) + fileManager(assetsFolderFor, saveAsset, listPosts exclusion) + settings row + tests
         │  (defines assetsFolderFor — the folder the sweep scans)
         ▼
[T11] orphan cleanup ── media-grid(extractLinkTargets, findOrphanAssets) + main(command+modal+trash) + settings button + tests
```

T10 before T11: the sweep scans the co-located assets folder (`assetsFolderFor`).

Lucky break: `DEFAULT_SETTINGS` is `postsFolder:"thino"` + `assetsSubfolder:"assets"`
→ `assetsFolderFor` = `thino/assets`, the v0.3.0 default path. Existing
`saveAsset`/link tests keep passing unchanged.

## Tasks (vertical slices, each: code + tests + build green)

### T10 — Co-located assets (SPEC §2.J)

- `src/types.ts`: replace `assetsFolder: string` with `assetsSubfolder: string`
  (default `"assets"`). `mergeSettings` needs no change — it's a scalar string
  (generic typeof copy); a legacy `assetsFolder` key is dropped as unknown
  (AC J.4).
- `src/fileManager.ts`:
  - `assetsFolderFor(settings)` (pure) = `<normalizeFolder(postsFolder)>/<assetsSubfolder>`
    (just the subfolder when `postsFolder` is empty).
  - `saveAsset` computes its target via `assetsFolderFor` instead of
    `normalizeFolder(settings.assetsFolder)` (AC J.2). Filename/never-overwrite
    logic unchanged.
  - `listPosts` excludes any file with a **directory segment** equal to
    `settings.assetsSubfolder`, at any depth (`<anySource>/assets/**`) — replaces
    the single-`assetsFolder` `isWithinFolder` exclusion (AC J.3). Add pure
    helper `isInAssetsSubfolder(path, name)`.
- `src/settings.ts`: replace the absolute **Assets folder** text row with an
  **Assets subfolder** name row (placeholder `assets`; desc: folder name inside
  each source for pasted media, excluded from the timeline) (AC J.1).
- Tests:
  - `assets.test.ts`: `assetsFolderFor` derivation (root + nested source);
    `saveAsset` with `postsFolder:"thino/work"` → `thino/work/assets/…`; existing
    DEFAULT_SETTINGS cases still green.
  - `folderView.test.ts` (or `listPosts.test.ts`): rewrite the assets-exclusion
    case to the subfolder model — `thino/assets/x.md` **and**
    `thino/work/assets/y.md` excluded, `thino/work/a.md` kept.

**Checkpoint 10**: `npm test` + `npm run build` green; manual — paste into a post
under `thino/work` lands in `thino/work/assets/`; no `assets` file shows as a post.

### T11 — Orphaned-asset cleanup, manual sweep (SPEC §2.K)

- `src/media-grid.ts` (pure):
  - `extractLinkTargets(body)`: all link/embed targets — Markdown `[..](t)` and
    `![..](t)`, wiki `[[t]]` and `![[t]]` — URL-decoded, `#anchor`/`|alias`
    stripped (generalizes `extractImageEmbeds`, which stays) (AC K.2).
  - `findOrphanAssets(assetPaths, referencedTargets)`: returns asset paths kept
    out of the referenced set — an asset is **kept** if its full vault-relative
    path *or* its basename appears in `referencedTargets`; the rest are orphans
    (AC K.1).
- `src/main.ts`: register command **“Clean orphaned assets (active source)”**:
  load active-source posts, run `extractLinkTargets` over their bodies, list
  files under `assetsFolderFor(settings)`, compute orphans, open a confirm modal
  listing them; on confirm `vault.trash(file, true)` each (AC K.3–K.5). Scoped
  to the active source only; never auto-runs.
- `src/settings.ts`: add a **Clean orphaned assets** button invoking the same
  routine.
- Tests (`mediaGrid.test.ts`): `extractLinkTargets` (md/wiki, image+non-image,
  alias/anchor/space, ignores bare text); `findOrphanAssets` (full-path match
  keeps, basename match keeps, unreferenced → orphan, empty inputs).

**Checkpoint 11 (final)**: full suite + build green; manual in dev vault —
add an asset, reference then un-reference it, run the command → it appears in the
confirm modal → confirm trashes it (recoverable); a still-referenced asset is
never listed. Bump version + README (assets subfolder + cleanup command); walk
SPEC §2.J–§2.K.

## Files touched (v0.5.0)

| File | T10 | T11 |
|---|---|---|
| types.ts | ✓ | |
| fileManager.ts | ✓ | |
| settings.ts | ✓ | ✓ |
| media-grid.ts | | ✓ |
| main.ts | | ✓ |
| tests/assets.test.ts | ✓ | |
| tests/folderView.test.ts | ✓ | |
| tests/mediaGrid.test.ts | | ✓ |

## Reuse

- `extractImageEmbeds` regex pieces + alias/anchor strippers → `extractLinkTargets`.
- `normalizeFolder` for `assetsFolderFor`; `buildAssetFilename`/never-overwrite
  in `saveAsset` unchanged.
- Obsidian `Modal` for the confirm dialog; `vault.trash` (already used by
  delete-forever) for removal.

## Verification

Per checkpoint: `npm test` + `npm run build`. Pure logic unit-tested; DOM
(settings row, confirm modal, command) verified manually. Final: walk §2.J–§2.K.
