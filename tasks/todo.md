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
