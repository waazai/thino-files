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
