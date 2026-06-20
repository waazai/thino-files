<!--
STATUS: shipped through v0.4.0 (manifest version 0.4.0).
  v0.2.0 — sidebar, media attachments, archive/recycle, (folder view: later removed)
  v0.3.0 — media grid scope, multiple source folders, filter/post spacing
  v0.4.0 — folder-view removed (timeline only), source dropdown moved to sidebar
  v0.5.0 — PLANNED, NOT BUILT: co-located assets + orphan-asset cleanup sweep
  v0.6.0 — PLANNED, NOT BUILT: timeline-only scroll (pinned sidebar/composer)
           + collapsible fixed-height cards (independent of v0.5.0)
Each "# SPEC — Thino Files vX.Y.Z" section below is one increment; read top to
bottom for history. Sections may supersede earlier ones (e.g. v0.4.0 removed the
v0.2.0 folder view).
-->

# SPEC — Thino Files v0.2.0

Spec-driven development document. Extends the shipped v0.1.0 plugin (timeline,
composer, filter bar, card actions, task toggles) — **no existing behavior may
regress**. New scope: sidebar with status + calendar (original-Thino-style
layout), media attachments, archive + recycle bin, and a timeline/folder view
switch.

---

## 1. Objective

Bring Thino Files closer to the original Thino UX while keeping its core
difference — one Markdown file per post:

- **Users**: Obsidian users who quick-capture thoughts and want per-file posts
  with search/backlinks/graph support.
- **Goal**: at-a-glance activity (status counters, heatmap, calendar),
  media in posts, safe two-stage deletion (archive / recycle bin), and a
  folder-grouped alternative to the flat timeline.

## 2. Features & acceptance criteria

### §2.A Sidebar: status + heatmap + calendar

Layout matches original Thino: left sidebar inside the Thino view, timeline on
the right.

- **AC A.1** Sidebar renders left of the timeline column. Below a configurable
  width (~600 px container query or `is-narrow` class), sidebar collapses and a
  toggle button in the view header shows/hides it.
- **AC A.2** Status block shows three counters computed from loaded (non-deleted)
  posts: total posts, distinct tags, distinct active days (by `date`).
- **AC A.3** Heatmap shows the last 12 weeks as a 7×12 grid; cell intensity
  buckets by posts created that day (0 / 1–2 / 3–4 / 5+). Hover tooltip:
  `N posts on YYYY-MM-DD`.
- **AC A.4** Month calendar: current month by default, ‹ › navigation, dot on
  days that have posts. Clicking a day applies a `from:`/`to:` day filter to the
  visible list and highlights the day; clicking again clears it. Calendar
  filter composes with the filter bar (AND).
- **AC A.5** Counters, heatmap, and calendar refresh on every `refresh()`
  (post create/edit/delete/watcher).

### §2.B Media attachments

- **AC B.1** New setting **Assets folder** (default `thino/assets`). Created on
  demand, never scanned for posts.
- **AC B.2** Pasting or drag-dropping a file into the composer (or a card's
  edit textarea) saves the binary to the assets folder as
  `YYYYMMDD-HHmmss-{sanitized-name}.{ext}` (collision → `-2`, `-3`, …) and
  inserts a Markdown link at the cursor: images get `![name](path)`, other
  files `[name](path)`. Paths are vault-relative.
- **AC B.3** Cards render image embeds inline (standard `MarkdownRenderer`
  output); non-image links open the file in Obsidian on click.
- **AC B.4** Saving an asset never overwrites an existing file.

### §2.C Archive & recycle bin

Soft-state lives in frontmatter; files stay in place (paths/backlinks stable).

- **AC C.1** Frontmatter gains optional `archived: true` and `deleted: true`
  flags. Absent = active. Parser/serializer round-trip them; flags absent when
  false (no `archived: false` noise).
- **AC C.2** Card actions: new **Archive** icon sets `archived: true` and bumps
  `updated`. The existing **Delete** action now sets `deleted: true` (with the
  existing confirm popover) instead of trashing the file.
- **AC C.3** View has three list scopes — **Timeline** (default: not archived,
  not deleted), **Archived**, **Recycle bin** — switchable from the sidebar
  (counts shown next to each scope).
- **AC C.4** In Archived scope, cards offer **Unarchive** (clears flag). In
  Recycle bin scope, cards offer **Restore** (clears `deleted`) and **Delete
  forever** (confirm popover → `vault.trash`, current v0.1.0 behavior).
- **AC C.5** Status/heatmap/calendar count only non-deleted posts. Filter bar
  applies within the active scope.

### §2.D View modes: timeline ⇄ folder

- **AC D.1** Header control (segmented toggle or icon) switches between
  **Timeline** (flat, newest first — current behavior) and **Folders** mode.
  Choice persists in settings.
- **AC D.2** `listPosts` becomes recursive: posts in subfolders of the posts
  folder are loaded (assets folder excluded). Timeline mode shows them in the
  same flat newest-first list.
- **AC D.3** Folders mode groups cards under one collapsible header per
  subfolder (top-level child of the posts folder; direct children grouped under
  the posts folder's own name, e.g. `thino/`). Headers show post counts;
  collapsed state kept for the session. Groups sorted alphabetically, posts
  inside newest first.
- **AC D.4** Filter bar, calendar filter, and scope (§2.C) all apply in both
  modes.

## 3. Commands

No new palette commands required. Existing: `Open timeline`. Dev workflow:

```bash
npm run dev     # esbuild watch
npm run build   # tsc -noEmit + production bundle
npm test        # vitest unit suite
```

## 4. Project structure

New/changed modules (keep current layout conventions):

| Module | Change |
|---|---|
| `src/types.ts` | `PostFrontmatter` + `archived?`, `deleted?`; settings + `assetsFolder`, `viewMode` |
| `src/frontmatter.ts` | Round-trip optional boolean flags |
| `src/fileManager.ts` | Recursive `listPosts`, `setFlags`/archive/restore helpers, `saveAsset` (name building pure; write via narrow vault interface) |
| `src/stats.ts` (new) | Pure: counters, heatmap buckets, posts-per-day map |
| `src/Sidebar.ts` (new) | Status block, heatmap, calendar, scope switcher (DOM only, consumes `stats.ts`) |
| `src/TimelineView.ts` | Two-column layout, scope + view-mode state, calendar filter composition, folder grouping render |
| `src/PostCard.ts` | Archive/unarchive/restore/delete-forever actions per scope; paste/drop in edit mode |
| `src/Composer.ts` | Paste/drop → `saveAsset` → insert link |
| `src/settings.ts` | New settings rows |
| `styles.css` | Sidebar grid, heatmap, calendar, group headers |

## 5. Code style

Follow existing conventions (see README "Code layout"):

- Pure logic (stats, grouping, name building, flag editing) free of `obsidian`
  imports; vault access through narrow interfaces (`VaultLike`, etc.).
- DOM via Obsidian helpers (`createDiv`, `setIcon`), CSS classes prefixed
  `thino-files-`.
- Comments only for non-obvious constraints; reference AC numbers like existing
  code (`AC §2.x`).
- TypeScript strict; no new runtime dependencies.

## 6. Testing strategy

Vitest, pure-logic first (no Obsidian runtime), vault faked as in `tests/`:

- `frontmatter`: flags round-trip; legacy files without flags parse as active.
- `stats`: counters, heatmap bucketing, day-key map (timezone-safe via local
  date parts).
- `fileManager`: recursive listing (assets folder excluded), asset filename
  building + collision suffixes, archive/restore flag edits bump `updated`,
  delete-forever calls trash.
- `filter`: calendar day filter composes with query.
- Grouping: subfolder key derivation for folder mode.

UI (sidebar DOM, paste events) verified manually in a dev vault — consistent
with v0.1.0 practice.

## 7. Boundaries

**Always**
- Preserve all v0.1.0 behavior and file format compatibility (files without
  new flags remain valid).
- Keep destructive actions two-step: confirm popover, and permanent delete only
  from Recycle bin via `vault.trash`.
- Read/write only inside the posts folder + assets folder.

**Ask first**
- Any change to the frontmatter schema beyond `archived`/`deleted`.
- Moving files on archive/delete (explicitly rejected — flags only).
- New runtime dependencies.

**Never**
- Permanently delete outside Recycle bin "Delete forever".
- Scan the whole vault.
- Touch post `date` (creation timestamp is immutable).

---

# SPEC — Thino Files v0.3.0

Extends shipped v0.2.0 (sidebar status/heatmap/calendar, media attachments,
archive/recycle, timeline⇄folder view) — **no existing behavior may regress**.
New scope: a layout breathing-gap fix, a **Media** grid scope, and
**multiple source folders with one active at a time**.

---

## 1. Objective

Three targeted changes, smallest blast radius first:

1. Visual: add a small gap between the filter bar and the first post so the
   search input and posts don't touch.
2. Browse captured images at a glance via a **Media** grid scope.
3. Let users configure several post source folders and switch which one is
   active (only one shown at a time).

**Users**: same as v0.2.0 — Obsidian quick-capture users, now juggling more
than one capture folder (e.g. `thino/`, `journal/`, `work-log/`) and wanting a
photo-wall view of what they've attached.

---

## 2. Features & acceptance criteria

### §2.E Filter-bar / list spacing

- **AC E.1** A small vertical gap separates `.thino-files-filterbar` from the
  first item in `.thino-files-list` (default `var(--size-4-2)`). The gap also
  sits below committed filter chips, so chips never touch the first post.
- **AC E.2** Pure CSS only — no DOM or TS changes. Sidebar, composer, toolbar,
  and folder-group spacing are unchanged.

### §2.F Media grid scope

A fourth list scope, surfaced in the sidebar scope switcher alongside Timeline /
Archived / Recycle bin (per chosen UI placement).

- **AC F.1** Scope list gains **Media**. Selecting it replaces the card list
  with a responsive thumbnail grid. The Timeline/Folders view-mode toggle does
  not apply while Media is active (grid only).
- **AC F.2** Grid source = **images embedded in posts** that are in the active
  (non-archived, non-deleted) timeline scope. Image embeds are extracted from
  post bodies: Markdown `![alt](path)` and Obsidian wiki-embeds `![[path]]`,
  restricted to image extensions (`png jpg jpeg gif webp svg avif bmp`). One
  tile per embed occurrence (a post with 3 images yields 3 tiles).
- **AC F.3** The filter bar and calendar day filter apply: the grid shows images
  only from posts that match the current query/day. Counts update on every
  `refresh()`, consistent with the other scopes.
- **AC F.4** Each tile renders the image (resolved to a vault resource path) and,
  on click, opens the **source post's** `.md` file in an editor pane (reuses
  `openPost`, honoring `openInNewPane`). Hover tooltip shows the post date.
- **AC F.5** Tiles are ordered by their post's `date` descending (newest first);
  within one post, by order of appearance in the body.
- **AC F.6** Empty state ("No media yet.") shows when no matching images exist.
- **AC F.7** Image-embed extraction is a **pure function** (no `obsidian`
  import), unit-tested; only path→resource resolution and DOM touch Obsidian.

### §2.G Multiple source folders, one active

- **AC G.1** New setting **Source folders** — an ordered list of vault folder
  paths (default: a single entry `thino`). Settings UI allows add / edit /
  remove rows; an empty list falls back to the default single folder.
- **AC G.2** New setting **Active source folder** — a picker (dropdown) over the
  configured Source folders selecting the one currently displayed. Exactly one
  is active. Switching it persists and triggers `refreshTimelines()`.
- **AC G.3** The timeline, sidebar stats, watcher, post creation, and asset
  attachment all operate on the **active** folder only — identical to today's
  single-folder behavior. No two folders are ever merged into one view.
- **AC G.4** Back-compat: existing `data.json` with the old single `postsFolder`
  string still loads — its value seeds both Source folders (single entry) and
  Active source folder. `settings.postsFolder` continues to mean "the active
  folder" so all existing call sites (`listPosts`, `createPost`, `saveAsset`,
  `watchVault`) need no change.
- **AC G.5** (UX) A compact source switcher in the view toolbar mirrors the
  Active-source setting (writes the same value), so users can switch without
  opening settings. Optional-but-included; same single source of truth.

---

## 3. Commands

No new palette commands. Dev workflow unchanged (`npm run dev|build|test`).

---

## 4. Project structure

| Module | Change |
|---|---|
| `src/types.ts` | `ThinoFilesSettings` gains `sourceFolders: string[]`; `postsFolder` redefined as the **active** folder (derived/kept in sync). New `PostScope` value `media`. |
| `src/settings.ts` | `mergeSettings` array-guard for `sourceFolders` + seed-from-legacy `postsFolder` (AC G.4). Settings UI: editable Source-folders list (G.1) + Active-source dropdown (G.2). |
| `src/media-grid.ts` (new) | Pure: `extractImageEmbeds(body): string[]` (Markdown + wiki embeds, image-ext filter) — AC F.2/F.7. |
| `src/filter.ts` | `PostScope` includes `media`; `matchScope` treats `media` like `timeline` for which posts qualify (grid renderer then pulls their images). |
| `src/Sidebar.ts` | Add **Media** to the scope switcher with its tile count. |
| `src/TimelineView.ts` | When scope = `media`, render grid (resolve `vault.getResourcePath`, click→`openPost`) instead of card list; hide view-mode toggle. Optional toolbar source switcher (G.5) writing `settings.postsFolder`/active. |
| `styles.css` | `.thino-files-filterbar { margin-bottom: var(--size-4-2) }` (E.1); `.thino-files-media-grid` responsive grid + tile styles. |

No new runtime dependencies.

---

## 5. Code style

Unchanged from v0.2.0: pure logic free of `obsidian` imports (image extraction,
settings merge); vault access via narrow interfaces; DOM via Obsidian helpers
with `thino-files-` class prefix; comments reference AC numbers (`AC §F.x`);
TypeScript strict.

---

## 6. Testing strategy

Vitest, pure-logic first:

- `media-grid`: `extractImageEmbeds` — Markdown `![](.png)`, wiki `![[ .jpg ]]`,
  multiple per body in order, ignores non-image links and bare text, handles
  paths with spaces/subfolders.
- `settings`: `mergeSettings` seeds `sourceFolders` + active from a legacy
  `postsFolder`-only object; array-guard rejects a non-array `sourceFolders`;
  empty list falls back to default.
- `filter`: `matchScope(post, "media")` qualifies the same posts as `timeline`.

UI (grid DOM/resource paths, source switcher, the CSS gap) verified manually in
a dev vault — consistent with prior practice.

---

## 7. Boundaries

**Always**
- Preserve all v0.2.0 behavior and file-format compatibility.
- Operate on exactly one active source folder at a time (G.3).
- Keep image extraction pure and unit-tested.

**Ask first**
- Showing media from the assets folder directly (rejected for now — grid is
  images-in-posts only).
- Merging/aggregating multiple source folders into one combined view.
- Any frontmatter schema change.

**Never**
- Scan the whole vault or read outside the active source + assets folders.
- Add runtime dependencies.
- Touch post `date`.

---

# SPEC — Thino Files v0.4.0

Extends shipped v0.3.0 — **no other behavior may regress**. Two changes:
remove the timeline/folder view toggle (timeline becomes the only view), and
move the source-folder switcher into the sidebar above the stats.

---

## 1. Objective

Simplify the view to a single flat timeline and make source switching a
first-class sidebar control:

1. The folder-grouping view mode and its toggle icon are unwanted — remove the
   feature and **all** code behind it, leaving the flat timeline as the only
   view.
2. Replace the v0.3.0 toolbar source switcher with a dropdown at the **top of
   the sidebar, above the posts/tags/days stats**, to choose the timeline's
   source folder.

**Users**: same as prior versions; this is a UX simplification, not new scope.

---

## 2. Features & acceptance criteria

### §2.H Remove folder view — timeline only

- **AC H.1** The timeline/folders toggle is gone from the toolbar; the view
  always renders the flat, newest-first list. No icon or control hints at a
  second mode.
- **AC H.2** All folder-grouping code is removed with no dead references
  (a `grep` for `viewMode`/`ViewMode`/`groupByFolder`/`PostGroup`/`renderGroups`/
  `collapsedGroups`/`viewtoggle`/`thino-files-group` comes back empty): the
  `viewMode` setting + `ViewMode` type and default, `groupByFolder`/`PostGroup`
  in `fileManager.ts`, `renderGroups`/`collapsedGroups`/`renderViewToggle` and
  the toggle element in `TimelineView.ts`, the view-toggle + folder-group CSS,
  and the `groupByFolder` unit tests.
- **AC H.3** Recursive listing is **retained**: posts in subfolders of the
  source folder still appear in the one flat list. `isWithinFolder`, recursive
  `listPosts`, `affectsFolder`, and their tests are unchanged and green.
- **AC H.4** A `data.json` carrying a stale `viewMode` key loads without error
  (unknown keys are dropped by `mergeSettings`); no migration needed.

### §2.I Source-folder dropdown in the sidebar

- **AC I.1** A labeled source dropdown sits at the **top of the sidebar, above**
  the status counters (posts / tags / days).
- **AC I.2** It lists every configured `sourceFolders` entry; the selected value
  is the active folder (`postsFolder`). It is **always shown**, even when only
  one folder is configured.
- **AC I.3** Changing the selection sets the active folder, persists it, and
  refreshes the timeline and the rest of the sidebar (stats, heatmap, calendar,
  scope counts all recompute for the newly active folder).
- **AC I.4** The v0.3.0 toolbar source switcher (§2.G AC G.5) is removed — the
  sidebar dropdown is the only in-view source control. The settings-tab
  **Active source folder** picker remains and stays in sync (same setting).

> **Source model note**: the manual `sourceFolders[]` list from v0.3.0 is
> **kept** (no auto-discovery of subfolders). The sidebar dropdown lists exactly
> those configured folders.

---

## 3. Commands

No new palette commands. Dev workflow unchanged (`npm run dev|build|test`).

---

## 4. Project structure

| Module | Change |
|---|---|
| `src/types.ts` | Remove `ViewMode` type, `viewMode` field + default. |
| `src/fileManager.ts` | Remove `groupByFolder` + `PostGroup`. Keep `isWithinFolder`/recursive `listPosts`/`affectsFolder`. |
| `src/TimelineView.ts` | Remove `renderViewToggle`, `renderGroups`, `collapsedGroups`, the toggle element, the `viewMode` branch in `renderList`, and the toolbar source switcher (`renderSourceSwitcher`/`sourceSwitcherEl`). Add `onSourceChange` to the sidebar wiring → set `postsFolder`, save, `refresh()`. Pass `sourceFolders` + active into `sidebar.update`. |
| `src/Sidebar.ts` | New `sourceEl` rendered above `statusEl`: a `<select>` of `sourceFolders` (value = active) with an `onSourceChange` callback; rebuilt on `update`. |
| `styles.css` | Remove `.thino-files-viewtoggle*` and `.thino-files-group*`. Add a small `.thino-files-source` selector style. |
| `tests/folderView.test.ts` | Drop the `groupByFolder` describe + its import; keep `isWithinFolder`/recursive-listing/`affectsFolder` tests. |

No new runtime dependencies.

---

## 5. Code style

Unchanged: pure logic free of `obsidian`; DOM via Obsidian helpers with
`thino-files-` prefix; comments reference AC numbers (`AC §H.x`/`§I.x`);
TypeScript strict; remove rather than comment-out dead code.

---

## 6. Testing strategy

- Net removal of the `groupByFolder` tests; recursion/watcher tests stay green.
- No new pure logic (the dropdown is DOM-only) → sidebar dropdown placement,
  options, and refresh-on-change are verified manually in a dev vault, per
  prior practice.
- `npm test` + `npm run build` green after the removal (no dangling imports,
  strict typecheck passes).

---

## 7. Boundaries

**Always**
- Keep the flat timeline recursive (subfolder posts visible) and preserve all
  non-folder-view v0.3.0 behavior + file-format compatibility.
- Remove dead code outright (no commented-out blocks, no orphaned CSS/types).

**Ask first**
- Removing recursive listing (explicitly kept this round).
- Any further change to the scope switcher or settings schema.

**Never**
- Reintroduce a folder-grouping mode or a second view toggle.
- Scan the whole vault or read outside the active source + assets folders.
- Add runtime dependencies.

---

# SPEC — Thino Files v0.5.0

Asset rework, split out of v0.4.0 to ship independently after the view
simplification. Extends whatever v0.4.0 shipped — **no regression**.

---

## 1. Objective

Make each source folder self-contained for media, and give users a safe way to
reclaim space from attachments no post references any more:

1. Store pasted/dropped assets **inside the active source folder** instead of one
   global folder.
2. Add a **manual, confirm-gated** "clean orphaned assets" sweep (nothing is
   ever auto-deleted).

**Users**: same; this is storage hygiene + portability.

---

## 2. Features & acceptance criteria

### §2.J Co-located assets (per source folder)

Replaces the single absolute **Assets folder** setting (§2.B/§2.G) with a
per-source **assets subfolder** so each source is self-contained and portable.

- **AC J.1** New setting **Assets subfolder** — a folder *name* (default
  `assets`), replacing the old absolute `assetsFolder` path. The settings-tab
  row changes from a vault path to this name.
- **AC J.2** Pasted/dropped attachments save under
  `<active source folder>/<assets subfolder>/` (e.g. active source `thino/work`
  → `thino/work/assets/`). Filename building + never-overwrite (§2.B AC B.2/B.4)
  unchanged. The inserted Markdown link stays vault-relative, so existing posts
  and rendering are unaffected.
- **AC J.3** `listPosts` excludes any file whose path contains a segment equal
  to the assets subfolder name (so `<anySource>/assets/**` is never treated as
  a post), at any depth. Recursive post listing otherwise unchanged.
- **AC J.4** Back-compat: a legacy `assetsFolder` value in `data.json` is
  dropped (unknown key); the default `assets` subfolder applies. Because the
  default root source `thino` previously stored to `thino/assets`, existing
  links keep resolving — only the *setting shape* changes, not old paths.

### §2.K Orphaned-asset cleanup (manual sweep)

Today nothing removes assets when a post is deleted or an embed is edited out,
so attachment files orphan and accumulate. Add an **opt-in, confirm-gated**
sweep — no automatic deletion.

- **AC K.1** Pure `findOrphanAssets(assetPaths, referencedTargets)` returns the
  asset paths not referenced by any post: an asset is **kept** if its full
  vault-relative path *or* its basename appears in `referencedTargets` (the
  basename fallback biases against deleting wiki-embedded or hand-linked files).
- **AC K.2** Pure `extractLinkTargets(body)` collects all link/embed targets
  from a post body — Markdown `[..](t)` and `![..](t)`, wiki `[[t]]` and
  `![[t]]` — URL-decoded, with `#anchor`/`|alias` stripped. (Generalizes
  `extractImageEmbeds`, which stays for the media grid.)
- **AC K.3** A palette command **“Clean orphaned assets (active source)”** (and
  an equivalent settings-tab button) scans the active source's assets subfolder,
  diffs against `extractLinkTargets` over that source's posts, and shows the
  orphan list in a confirm modal. Confirming trashes them via `vault.trash`
  (system trash, recoverable); cancel does nothing.
- **AC K.4** Cleanup is **never** triggered automatically — not on soft-delete,
  not on edit, not on “delete forever”, not on refresh. Only the explicit
  command/button runs it.
- **AC K.5** The sweep is scoped to the **active** source's assets folder only;
  other sources' assets are never touched in one run.

---

## 3. Commands

One new palette command: **Clean orphaned assets (active source)** (AC §K.3).
Existing `Open timeline` unchanged. Dev workflow unchanged
(`npm run dev|build|test`).

---

## 4. Project structure

| Module | Change |
|---|---|
| `src/types.ts` | Replace `assetsFolder: string` with `assetsSubfolder: string` (default `"assets"`). |
| `src/fileManager.ts` | `assetsFolderFor(settings)` = `<postsFolder>/<assetsSubfolder>`; `saveAsset` writes there. `listPosts` excludes any path with a segment === assets subfolder name. |
| `src/media-grid.ts` | Add pure `extractLinkTargets(body)` + `findOrphanAssets(assetPaths, referencedTargets)` (AC §K.1/K.2). |
| `src/main.ts` | Register the **Clean orphaned assets** command → confirm modal → `vault.trash`. |
| `src/settings.ts` | Replace the absolute **Assets folder** text row with an **Assets subfolder** name row; add a **Clean orphaned assets** button. |
| `tests/mediaGrid.test.ts` | Add `extractLinkTargets` + `findOrphanAssets` cases. |
| `tests/assets.test.ts` | Update for `assetsSubfolder` / `assetsFolderFor` path derivation. |

No new runtime dependencies.

---

## 5. Code style

Unchanged: pure logic free of `obsidian`; DOM via Obsidian helpers with
`thino-files-` prefix; comments reference AC numbers (`AC §J.x`/`§K.x`);
TypeScript strict. The orphan-scan core stays pure; only the command wiring +
confirm modal + `vault.trash` touch Obsidian.

---

## 6. Testing strategy

- `extractLinkTargets`: md + wiki, image + non-image, alias/anchor/space
  handling; `findOrphanAssets`: full-path match keeps, basename match keeps,
  unreferenced → orphan, empty inputs.
- `assets`: `saveAsset` writes under `<activeSource>/<assetsSubfolder>`;
  `listPosts` excludes the assets subfolder at any depth.
- DOM-only (settings row, confirm modal) verified manually in a dev vault.
- `npm test` + `npm run build` green; no dangling imports; strict typecheck.

---

## 7. Boundaries

**Always**
- Gate every asset deletion behind an explicit user action + confirm modal;
  always `vault.trash` (recoverable), never hard-delete.
- Preserve v0.4.0 behavior + file-format compatibility.

**Ask first**
- Any automatic asset deletion (out of scope this round — manual sweep only).
- Any change that would move/rename existing assets (only *new* assets go to
  the co-located folder; old links are left intact).

**Never**
- Delete assets without confirmation, or sweep sources other than the active one.
- Scan the whole vault or read outside the active source + assets folders.
- Add runtime dependencies.

---

# SPEC — Thino Files v0.6.0

Spec-driven development document. Pure UI/layout increment over the shipped
v0.4.0 timeline — **no existing behavior, data, or file format may regress**.
Independent of the planned v0.5.0 asset work; can ship before or after it.
New scope: (1) the post list is the only scrolling region so the sidebar,
composer, and filter bar stay pinned; (2) post cards always show their header,
clamp their body to a fixed height, and offer an inline **Show more** expand.

This increment was scoped via a grilling session; the decisions below are final.

---

## 1. Objective

- **Users**: Obsidian users browsing a long Thino Files timeline.
- **Goal**: keep capture + navigation chrome (sidebar stats/calendar, composer,
  filter bar) fixed while scrolling, and make the timeline scannable by giving
  every card a predictable height with opt-in expansion — without opening a file
  or losing the date/tags header.

## 2. Features & acceptance criteria

### §2.L Timeline-only scroll (pinned chrome)

- **AC L.1** Within the Thino Files view, only `.thino-files-list` scrolls. The
  sidebar, composer, toolbar, and filter bar remain fixed while the list scrolls.
- **AC L.2** The sidebar no longer drifts/scrolls with the list (the reported
  bug). It stays put for the full scroll range of the list.
- **AC L.3** `.thino-files-main` becomes a height-bound flex column
  (`display:flex; flex-direction:column; min-height:0; height:100%`) so its
  child `.thino-files-list` (`flex:1; overflow-y:auto; min-height:0`) gets a
  constrained height and scrolls internally instead of growing the whole view.
- **AC L.4** Existing narrow-width sidebar auto-collapse (AC §A.1) and the
  sidebar toggle button still work unchanged.
- **AC L.5** No horizontal scrollbar is introduced; `min-width:0` on the main
  column is preserved.

### §2.M Collapsible fixed-height cards

Applies to every `PostCard` scope — **timeline, archived, recycle**. The media
grid (§F) is unaffected.

- **AC M.1** Each card always renders its header (date chip + tag pills +
  actions) fully visible; collapsing clips the **body only**, never the header.
- **AC M.2** The collapsed card body is clamped to a fixed CSS max-height of
  **~8em** (static; no JS measurement), so a collapsed card is roughly the
  height of the composer block. A bottom fade indicates clipped content.
- **AC M.3** After each body render, the card measures overflow
  (`bodyEl.scrollHeight > clamp`). A **Show more** control appears **only when
  the body overflows**; short posts show no control and no fade.
- **AC M.4** Clicking **Show more** removes the clamp inline (no file I/O, no
  pane) and the label becomes **Show less**; clicking again re-applies the
  clamp. State is per-card and ephemeral.
- **AC M.5** The expand is purely inline. The existing **Open source file**
  action (AC §2.5) is unchanged and remains the way to open the `.md`.
- **AC M.6** The overflow check + clamp re-apply after any body re-render,
  including the task-checkbox toggle re-render (it must not strand the card in
  an inconsistent expanded/clamped state).
- **AC M.7** Edit mode shows the textarea at full height — the clamp is never
  applied while editing. Re-collapse is recomputed when edit mode exits and the
  body re-renders.
- **AC M.8** Collapse state does not persist across `refresh()` / re-render;
  cards re-collapse by default (acceptable — no settings, no storage).
- **AC M.8a** The overflow measurement (`scrollHeight > clamp`, AC M.3) must run
  against a **laid-out** element. When `applyCollapse()` runs while the leaf is
  detached / `display:none` (the **jump to source file → back** case), both
  `scrollHeight` and `clientHeight` read `0`, the body is wrongly judged
  non-overflowing, the clamp is dropped, and the card renders **fully expanded
  with no toggle**. A `0`-height read must **not** clear the collapse: treat
  unmeasurable layout as "keep clamped, re-measure when visible" (e.g. defer the
  check to the view's reveal/resize) so a card never spuriously expands on
  return. Re-collapse-by-default (M.8) still holds — the card returns collapsed,
  with its **Show more** toggle present when it overflows.
- **AC M.9** The header shows a **title** = the filename slug, *verbatim* (no
  humanizing). The slug is recovered by `postSlug(path, date, filenameFormat)`,
  which strips the `{date}-` prefix; the blank-slug HHmmss fallback (with or
  without a `-N` collision suffix) yields `""` and renders no title. Posts
  without a real slug keep the date+tags-only header (no regression to §M.1).

### §2.N Verbatim slug sanitization

Applies to `sanitizeSlug` and therefore to post filenames (`buildFilename`) and
asset filenames (`buildAssetFilename`).

- **AC N.1** The user's slug is kept **verbatim** — case, internal spaces,
  punctuation, and Unicode are preserved exactly as typed. Normalization is
  silent (no prompt, no warning).
- **AC N.2** Only characters **illegal in a filename** are removed:
  `\ / : * ? " < > |` and ASCII control chars (`0x00`–`0x1F`). Leading/trailing
  whitespace is trimmed. Nothing else is touched — no lowercasing, no
  space→`-`, no hyphen collapsing.
- **AC N.3** If sanitization leaves an empty string, the caller applies its
  blank fallback — `HHmmss` for `buildFilename`, `"file"` for
  `buildAssetFilename`.
- **AC N.4** Example: slug `Idea: A/B test` → file
  `2026-06-12-Idea AB test.md`; `My Shot (1).PNG` →
  `…-My Shot (1).png` (ext lowercased per existing asset rule, stem verbatim).

## 3. Out of scope

- No new settings, no persisted expand state, no per-post pinning.
- No title/heading extraction (posts have no title; header stays date+tags).
- No change to media grid, filtering, scopes, or data model.

## 4. Implementation outline

| File | Change |
|---|---|
| `styles.css` | §L: make `.thino-files-main` a height-bound flex column (`display:flex; flex-direction:column; height:100%; min-height:0`); add `min-height:0` to `.thino-files-list`. Confirm `.thino-files-sidebar` stays `position:sticky; top:0` (or set `align-self:flex-start`) so it holds. §M: `.thino-files-card-body` collapsed variant with `max-height` clamp (~8em) + `overflow:hidden` + bottom fade; `.thino-files-card-body--expanded` removes the clamp; `.thino-files-card-toggle` style for Show more/less. |
| `src/PostCard.ts` | Add a collapse class on the body by default; after `renderBody()` measure `scrollHeight` vs clamp and, if overflowing, render a **Show more/Show less** toggle that flips the expanded class + label. Recompute on every `renderBody()` (covers task toggle + edit exit). Suppress clamp in `enterEditMode()`. Render the slug title in the header via `postSlug` (§M.9). |
| `src/fileManager.ts` | Add pure `postSlug(path, isoDate, dateFormat)` — strips the date prefix, returns the slug verbatim, `""` for the HHmmss fallback (§M.9). |
| `tests/postSlug.test.ts` | Unit-test `postSlug`: verbatim slug, no humanizing, custom date format, HHmmss fallback → "", collision-suffix cases. |
| `src/TimelineView.ts` | No data-flow change; layout fix lives in CSS. |

No new runtime dependencies.

## 5. Code style

Unchanged: pure logic free of `obsidian`; DOM via Obsidian helpers with the
`thino-files-` prefix; comments reference AC numbers (`AC §L.x` / `§M.x`);
TypeScript strict. The clamp/overflow logic is DOM-only and lives in `PostCard`.

## 6. Testing strategy

- §L and §M are DOM/CSS behavior; the `obsidian` test mock has no real layout
  engine (`scrollHeight` is not simulated), so these are **verified manually in
  a dev vault**: (a) scroll a long timeline — sidebar/composer/filter stay put,
  only the list moves; (b) a long post clamps + shows **Show more**, expands and
  re-collapses inline; (c) a short post shows no control; (d) toggling a task
  checkbox in a clamped post keeps it clamped; (e) edit mode shows full height;
  (f) archived + recycle scopes clamp too.
- Any pure helper extracted (e.g. a clamp-decision predicate) gets a unit test;
  otherwise no new `tests/*.test.ts`.
- `npm test` + `npm run build` green; no dangling imports; strict typecheck.

## 7. Boundaries

**Always**
- Keep the date+tags header fully visible in every state (AC M.1).
- Preserve v0.4.0 behavior, file format, and the existing **Open source file**
  action and narrow-width sidebar collapse.

**Ask first**
- Adding any setting, persisted expand state, or dynamic composer-height
  matching (explicitly deferred — static ~8em clamp this round).

**Never**
- Open a file or do file I/O on inline expand.
- Clip or hide the card header.
- Add runtime dependencies.

---

# SPEC — Thino Files v0.7.0

Spec-driven development document. Performance/scalability increment over the
shipped timeline — **no existing behavior, data, or file format may regress**.
New scope: the post list renders **incrementally** (infinite scroll, 50 cards
per batch) instead of building a DOM card for every post up front, fixing the
multi-second freeze observed at ~422 posts. Builds on §L (the list is the only
scroll region) and §M (collapsible cards) — appended cards inherit both.

Scoped via clarifying questions; the decisions below — **infinite scroll, batch
size 50, fixed constant (no setting)** — are final.

---

## 1. Objective

- **Users**: Obsidian users with a long Thino Files timeline (hundreds+ posts).
- **Goal**: keep the view responsive at scale. Today `renderList()` clears the
  list and synchronously builds a `PostCard` for **every** visible post on every
  render (`TimelineView.ts` §181–208); at ~422 posts this rebuilds hundreds of
  DOM subtrees at once and freezes the view. Render the newest batch first and
  reveal more as the user scrolls, so initial render and every refresh stay
  cheap regardless of total post count.

## 2. Features & acceptance criteria

### §2.O Incremental timeline rendering (infinite scroll)

Applies to the card-list scopes — **timeline, archived, recycle**. The media
grid (§F) is unaffected this round (it already lazy-loads images via
`loading="lazy"`). "Revealed" = the number of cards currently rendered.

- **AC O.1** The list renders at most `BATCH_SIZE = 50` cards initially — the
  newest 50 in the current scope/filter, preserving the existing
  date-descending order from `listPosts` (tie-broken by path). No DOM card is
  built for posts beyond the first batch.
- **AC O.2** As the user scrolls `.thino-files-list` (the only scroll region,
  §L) toward the bottom, the next `BATCH_SIZE` cards are appended automatically
  — no button, no page numbers. Appending **adds** cards after the existing
  ones; already-rendered cards are **not** rebuilt, so their §M inline
  expand/collapse state is preserved.
- **AC O.3** Batches keep revealing until all visible posts are shown; once the
  last post is rendered, loading stops (the sentinel + observer are removed).
- **AC O.4** Detection uses an `IntersectionObserver` rooted on
  `.thino-files-list`, observing a sentinel element placed after the last
  rendered card, with a `rootMargin` that pre-loads slightly before the true
  bottom so scrolling stays smooth. No scroll-event polling.
- **AC O.5** Self-fill: if a batch does not fill the viewport and more posts
  remain, batches keep appending until the viewport is filled or posts are
  exhausted — the sentinel never sits permanently visible with content pending.
- **AC O.6** **Filter / scope / day changes reset to the first batch.** Changing
  the filter query (FilterBar, `TimelineView.ts` §124), switching scope
  (§86), or selecting/clearing a calendar day (§90) re-renders from the top
  showing the newest `BATCH_SIZE`, scrolls the list to top, and installs a fresh
  observer.
- **AC O.7** **Data refreshes preserve the revealed count.** `refresh()` (disk
  watcher, source-folder switch, composer post — §168) and a card-action
  `renderList()` (archive/delete/restore via `setFlags` — §269) re-render
  showing `clampReveal(revealed, total)` = `min(max(revealed, BATCH_SIZE),
  total)` cards, and restore the prior list scroll offset — so a background
  change does not yank a deep-scrolled user back to the top.
- **AC O.8** Posting a new note (composer → `refresh()`) still shows it at the
  top of the list (AC §2.1); the preserve-count rule (O.7) never hides it.
- **AC O.9** Empty states (no posts / no matches) are unchanged. With fewer
  visible posts than `BATCH_SIZE`, there is no sentinel and no observer.
- **AC O.10** The `IntersectionObserver` is disconnected in `onClose()` and the
  previous one is disconnected on every full re-render — no observers leak
  across re-renders or view closes.
- **AC O.11** `BATCH_SIZE` is a fixed module constant — no setting, no UI, no
  persisted reveal state — consistent with the project's lean settings surface.

## 3. Out of scope

- No pagination controls / page numbers (infinite scroll chosen).
- No DOM virtualization/recycling — revealed cards stay in the DOM (bounded by
  how far the user scrolls, not by total post count up front). Variable +
  expandable card heights (§M) make windowing fragile; deferred.
- No batching of the media grid (already image-lazy); no "posts per page"
  setting; no persisted scroll position across sessions.
- No change to data model, sort order, filtering, scopes, or file format.

## 4. Implementation outline

| File | Change |
|---|---|
| `src/pagination.ts` (new) | Pure helpers + `export const BATCH_SIZE = 50`: `initialReveal(total)` = `min(total, BATCH_SIZE)`; `growReveal(revealed, total)` = `min(revealed + BATCH_SIZE, total)`; `clampReveal(revealed, total)` = `min(max(revealed, BATCH_SIZE), total)` (O.7 preserve path); `hasMore(revealed, total)` = `revealed < total`. No `obsidian` import. |
| `tests/pagination.test.ts` (new) | Unit-test the helpers: total `<` / `=` / `>` batch; `growReveal` stops at `total`; `clampReveal` stays `≥ BATCH_SIZE` and `≤ total`; `hasMore` boundaries (0, mid, `=total`). |
| `src/TimelineView.ts` | Add `revealed` count + `observer?: IntersectionObserver`. `renderList(opts?: { preserve?: boolean })`: reset paths set `revealed = initialReveal(total)`, preserve paths set `revealed = clampReveal(revealed, total)` and save/restore `listEl.scrollTop`; render the first `revealed` visible posts; if `hasMore`, append a `.thino-files-sentinel` and (re)create the observer (disconnecting the old one). New `appendBatch()`: `revealed = growReveal(...)`, create only the new slice's cards **before** the sentinel (no full rebuild), self-fill (O.5), remove sentinel + disconnect when `!hasMore`. Pass `{ preserve: true }` from §168/§269 callers; reset (default) from §86/§90/§124. Disconnect observer in `onClose()`. |
| `styles.css` | `.thino-files-sentinel` — minimal-height marker (optional subtle "loading…" affordance); must not affect §L/§M layout. |

`createCard()` is unchanged, so appended cards inherit §M collapse and all card
actions automatically. No new runtime dependencies.

## 5. Code style

Unchanged: pure logic (`pagination.ts`) free of `obsidian` and unit-tested; DOM
via Obsidian helpers with the `thino-files-` prefix; comments cite `AC §O.x`;
TypeScript strict. The sentinel/observer logic is DOM-only and lives in
`TimelineView`.

## 6. Testing strategy

- **Pure**: `tests/pagination.test.ts` covers `initialReveal` / `growReveal` /
  `clampReveal` / `hasMore` per AC §4.
- **DOM/observer**: the `obsidian` test mock has no layout engine, scroll
  metrics, or `IntersectionObserver`, so these are **verified manually in a dev
  vault with 400+ posts**: (a) initial render shows ~50 cards and the view is
  responsive (no multi-second freeze); (b) scrolling appends in batches until
  exhausted, then stops; (c) a filtered result `< 50` shows no sentinel;
  (d) changing filter/scope/day resets to the top with the newest 50;
  (e) archiving/deleting a deep-scrolled card keeps scroll position (no jump to
  top); (f) posting a new note shows it at the top; (g) the §M expand state of
  already-shown cards survives later appends; (h) closing/reopening the view
  repeatedly leaks no observers.
- `npm test` + `npm run build` green; strict typecheck; no dangling imports.

## 7. Boundaries

**Always**
- Preserve date-descending order, file format, the §L pinned-chrome scroll, and
  §M collapse on every rendered card — **including appended batches**.
- Keep new-post-at-top (AC §2.1) and the debounced disk-watcher behavior.

**Ask first**
- Switching to DOM virtualization, adding a "Posts per page" setting, or
  paginating the media grid (all deferred this round).

**Never**
- Render all posts up front again.
- Add runtime dependencies.
- Leak `IntersectionObserver`s across re-renders or view closes.
