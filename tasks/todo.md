# Thino Files v0.2.0 — Task List

Source: [plan.md](plan.md) · [SPEC.md](../SPEC.md)

## T1 — Archive & recycle bin (SPEC §2.C)

- [x] `types.ts`: optional `archived?` / `deleted?` on `PostFrontmatter`
- [x] `frontmatter.ts`: serialize flags only when true; parse flags; legacy files unchanged (AC C.1)
- [x] `fileManager.ts`: `buildFlaggedContent` (pure, bumps `updated`) + `setPostFlags`
- [x] `matchScope(post, scope)` — timeline / archived / trash
- [x] `PostCard.ts`: scope-dependent actions — archive, unarchive, restore, delete-forever (confirm → `vault.trash`) (AC C.2, C.4)
- [x] `TimelineView.ts`: scope state + temporary header tab strip with counts (AC C.3)
- [x] Tests: flag round-trip, legacy parse, `buildFlaggedContent`, `matchScope`, `setPostFlags`
- [x] **Checkpoint 1**: `npm test` + `npm run build` green; manual archive/delete/restore cycle

## T2 — Recursive listing + folder view (SPEC §2.D)

- [x] `fileManager.ts`: `isWithinFolder`, recursive `listPosts` excluding `assetsFolder`, recursive `affectsFolder` (AC D.2)
- [x] `types.ts`: `assetsFolder` (default `thino/assets`) + `viewMode` settings keys
- [x] `groupByFolder(posts, postsFolder)` pure — groups alpha-sorted, posts newest-first (AC D.3)
- [x] `TimelineView.ts`: header timeline⇄folders toggle (persisted), collapsible group headers with counts (AC D.1, D.3)
- [x] Filter bar + scope apply in both modes (AC D.4)
- [x] Tests: recursive listing, assets exclusion, `affectsFolder`, `groupByFolder`
- [x] **Checkpoint 2**: tests + build green; subfolder posts visible; toggle persists

## T3 — Sidebar: status, heatmap, calendar (SPEC §2.A)

- [x] `stats.ts` (new, pure): `postsPerDay`, `computeStatus`, `heatmapCells` (7×12, buckets 0/1–2/3–4/5+), `calendarGrid` (AC A.2, A.3)
- [x] `Sidebar.ts` (new): status block, heatmap with tooltips, month calendar with ‹ › nav + day select, scope switcher with counts (moved from T1 strip) (AC A.2–A.4)
- [x] `TimelineView.ts`: two-column layout; day filter composes AND with filter bar; sidebar refresh on `refresh()`; collapse toggle + narrow auto-collapse (AC A.1, A.4, A.5)
- [x] `styles.css`: layout, heatmap, calendar, narrow rules
- [x] Tests: stats counters, bucketing, calendar month edges (Dec/Jan rollover, leap Feb)
- [x] **Checkpoint 3**: tests + build green; day click filters and composes with `#tag`

## T4 — Media attachments (SPEC §2.B)

- [x] `settings.ts`: Assets folder settings row (AC B.1)
- [x] `fileManager.ts`: `buildAssetFilename` (`YYYYMMDD-HHmmss-{name}.{ext}`, collision suffix), `saveAsset` (createBinary, never overwrite), `buildMarkdownLink` (AC B.2, B.4)
- [x] `Composer.ts` + `PostCard.ts` editor: paste/drop → save → insert link at cursor (AC B.2)
- [x] Verify image embeds render on cards (AC B.3)
- [x] Tests: asset names/collisions, link building, never-overwrite, `insertAtCursor`
- [x] **Checkpoint 4 (final)**: full suite + build; paste screenshot renders; SPEC AC walk-through; bump version + README

---

# Thino Files v0.3.0 — Task List

Source: [plan.md](plan.md) · [SPEC.md](../SPEC.md)

## T5 — Filter-bar / list spacing (SPEC §2.E)

- [ ] `styles.css`: `.thino-files-filterbar { margin-bottom: var(--size-4-2) }` (AC E.1, E.2)
- [ ] **Checkpoint 5**: build green; manual — gap between search box and first post (also with chips)

## T6 — Media grid scope (SPEC §2.F)

- [ ] `media-grid.ts` (new, pure): `extractImageEmbeds(body)` — md `![]()` + wiki `![[]]`, image-ext only, alias/anchor stripped, in order (AC F.2, F.5, F.7)
- [ ] `filter.ts`: `PostScope` gains `"media"`; `matchScope(_, "media")` == timeline qualification (AC F.3)
- [ ] `Sidebar.ts`: **Media** scope row (icon `image`) + image count (AC F.1)
- [ ] `TimelineView.ts`: media scope renders grid (resolve linkpath → `getResourcePath` → `<img>`, click → `openPost`, title = date), hide view-mode toggle, empty state (AC F.1, F.4, F.5, F.6)
- [ ] `styles.css`: `.thino-files-media-grid` responsive tiles
- [ ] Tests: `extractImageEmbeds` (md/wiki/order/ignore-non-image/spaces/subfolder/alias); `matchScope` media
- [ ] **Checkpoint 6**: tests + build green; manual — grid shows, tile opens post, filter + calendar narrow

## T7 — Multiple source folders, one active (SPEC §2.G)

- [ ] `types.ts`: `sourceFolders: string[]` (default `["thino"]`); `postsFolder` = active folder
- [ ] `settings.ts` `mergeSettings`: array-guard + legacy seed from `postsFolder` + reconcile `postsFolder ∈ sourceFolders` + empty→default (AC G.1, G.4)
- [ ] `settings.ts` UI: editable Source-folders list + Active-source dropdown (writes `postsFolder`, save + refresh) (AC G.1, G.2)
- [ ] `TimelineView.ts`: toolbar source `<select>` mirroring active (AC G.5)
- [ ] Verify watcher/create/saveAsset untouched (read active `postsFolder` at call time, AC G.3)
- [ ] Tests: legacy seed, non-array reject, postsFolder reconcile, empty→default, non-string entries reject
- [ ] **Checkpoint 7 (final)**: full suite + build; switch active source persists, only its posts show, assets+posting work, legacy migrates; bump version + README; SPEC §2.E–§2.G walk

---

# Thino Files v0.4.0 — Task List

Source: [plan.md](plan.md) · [SPEC.md](../SPEC.md). (Asset rework §2.J/§2.K → v0.5.0, planned separately.)

## T8 — Remove folder view (SPEC §2.H)

- [ ] `types.ts`: delete `ViewMode` type, `viewMode` field + default
- [ ] `fileManager.ts`: delete `groupByFolder` + `PostGroup`; keep `isWithinFolder`/recursive `listPosts`/`affectsFolder` (AC H.3)
- [ ] `TimelineView.ts`: remove `groupByFolder`/`ViewMode` imports, `viewToggleEl`, `renderViewToggle`, `renderGroups`, `collapsedGroups`, the `viewMode` branch, the `onScopeChange` toggle line (AC H.1, H.2)
- [ ] `styles.css`: remove `.thino-files-viewtoggle*` + `.thino-files-group*`
- [ ] `tests/folderView.test.ts`: drop `groupByFolder` describe + import
- [ ] AC H.4: spot-check stale `viewMode` key still ignored by `mergeSettings`
- [ ] **Checkpoint 8**: tests + build green; removal grep returns nothing; subfolder posts still show flat

## T9 — Source dropdown in the sidebar (SPEC §2.I)

- [ ] `Sidebar.ts`: `sourceEl` above `statusEl`; `onSourceChange` callback; `update(posts, scope, sourceFolders, active)` renders always-shown `<select>` (AC I.1, I.2)
- [ ] `TimelineView.ts`: remove `sourceSwitcherEl`/`renderSourceSwitcher` (toolbar); wire `onSourceChange` → set `postsFolder` + save + refresh; pass folders+active to all `sidebar.update` calls (AC I.3, I.4)
- [ ] `styles.css`: `.thino-files-source` selector style
- [ ] **Checkpoint 9 (final)**: tests + build green; sidebar dropdown switches source, no toolbar switcher, settings picker in sync; bump version + README; SPEC §2.H–§2.I walk

---

# Thino Files v0.5.0 — Task List

Source: [plan.md](plan.md) · [SPEC.md](../SPEC.md)

## T10 — Co-located assets (SPEC §2.J)

- [ ] `types.ts`: `assetsFolder` → `assetsSubfolder: string` (default `"assets"`) (AC J.1, J.4)
- [ ] `fileManager.ts`: `assetsFolderFor(settings)` = `<postsFolder>/<assetsSubfolder>`; `saveAsset` uses it (AC J.2)
- [ ] `fileManager.ts`: `listPosts` excludes any dir segment === assets subfolder, any depth (`isInAssetsSubfolder`) (AC J.3)
- [ ] `settings.ts`: replace absolute Assets-folder row with Assets-subfolder name row (AC J.1)
- [ ] Tests: `assetsFolderFor` (root + nested), `saveAsset` under `thino/work/assets`, listPosts subfolder exclusion (both depths)
- [ ] **Checkpoint 10**: tests + build green; paste under a subfolder source lands in its `assets/`; no asset shows as a post

## T11 — Orphaned-asset cleanup, manual sweep (SPEC §2.K)

- [ ] `media-grid.ts`: pure `extractLinkTargets(body)` (md+wiki, decoded, alias/anchor stripped) (AC K.2)
- [ ] `media-grid.ts`: pure `findOrphanAssets(assetPaths, referencedTargets)` — keep on full-path OR basename match (AC K.1)
- [ ] `main.ts`: command "Clean orphaned assets (active source)" → scan `assetsFolderFor` vs active-source link targets → confirm modal → `vault.trash` (AC K.3–K.5)
- [ ] `settings.ts`: "Clean orphaned assets" button (same routine)
- [ ] Tests: `extractLinkTargets`, `findOrphanAssets` (full-path keep, basename keep, orphan, empty)
- [ ] **Checkpoint 11 (final)**: full suite + build; reference→unreference→sweep trashes it (recoverable), referenced asset never listed; bump version + README; SPEC §2.J–§2.K walk
