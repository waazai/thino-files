# CLAUDE.md

Guidance for working in the **Thino Files** codebase.

## What this is

An Obsidian plugin (id `thino-files`) providing a Twitter-style timeline where
**every post is its own Markdown file** with YAML frontmatter — instead of
appending lines to a daily note. Each capture becomes an atomic `.md` file, so
Obsidian search, backlinks, and graph view work per-post and the content renders
as plain GFM anywhere.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | esbuild watch — rebuilds `main.js` on change (inline sourcemap) |
| `npm run build` | `tsc -noEmit` typecheck, then a production esbuild bundle |
| `npm test` | Run the Vitest suite once (`vitest run`) |

Build entry is `src/main.ts` → `main.js`. `obsidian`, `electron`,
`@codemirror/*`, and `@lezer/*` are marked **external** (provided by the host
app) — never bundle them.

## Architecture

The codebase splits into **pure logic** (no `obsidian` runtime import) and
**UI/vault glue**. This split is load-bearing: the `obsidian` npm package ships
types only, so any module that imports it at runtime cannot load under Vitest.

### Pure modules — keep `obsidian` imports type-only, unit-tested
- `types.ts` — `Post` / `PostFrontmatter` / `ThinoFilesSettings` + `DEFAULT_SETTINGS`.
- `frontmatter.ts` — `serializePost` / `parsePost`, `toLocalIso`. Hand-rolled
  for the fixed schema (`date`, `updated`, `tags`, optional `archived`/`deleted`)
  so it stays dependency-free. Flags are serialized **only when true** so legacy
  files round-trip byte-identical.
- `fileManager.ts` — filename/date helpers (`sanitizeSlug`, `buildFilename`,
  `formatDate`, `insertAtCursor`, `overflowState`) **and** vault-bound CRUD that
  goes through a narrow `VaultLike` interface so tests can supply an in-memory fake.
- `filter.ts` — `parseQuery` / `matchPost` (client-side text/`#tag`/`from:`/`to:`)
  and `matchScope` over the `PostScope` union (`timeline | archived | trash | media`).
- `stats.ts` — sidebar aggregation: `postsPerDay`, `computeStatus`, heatmap
  buckets (0 / 1–2 / 3–4 / 5+), calendar grid.
- `media-grid.ts` — `extractImageEmbeds` / link-target extraction for the media
  grid and orphaned-asset cleanup (markdown `![]()` + wiki `![[]]`, image-ext only).
- `media.ts` — `bindAttachments`: paste/drop → save → splice link at cursor.

### UI / vault glue — import `obsidian` freely, no unit tests
- `main.ts` — `ThinoFilesPlugin extends Plugin`; registers the view, ribbon
  icon, `open-timeline` command, and settings tab; `refreshTimelines()`
  re-renders open leaves after a settings change.
- `TimelineView.ts` (`VIEW_TYPE_THINO_FILES`) — the `ItemView`: owns the
  in-memory post array, two-column layout, scope/day-filter state, vault watcher
  wiring, and path→resource resolution for media.
- `Sidebar.ts` — status counters, heatmap, month calendar, scope switcher,
  active-source dropdown.
- `Composer.ts` / `PostCard.ts` / `FilterBar.ts` — compose box, per-post card
  (render, inline edit, task toggle, archive/delete/restore actions), filter chips.
- `settings.ts` — settings tab + folder picker modal; `mergeSettings` migrates
  and guards persisted settings (e.g. legacy `postsFolder` → `sourceFolders`).

## Conventions

- **Never import `obsidian` at runtime in a pure module.** Use `import type`.
  If logic needs vault access, take a `VaultLike` parameter — don't reach for the
  real API. This is what keeps the suite runnable without the app.
- Timestamps are **timezone-less local ISO** (`toLocalIso`, e.g.
  `2026-06-12T14:30:22`); day keys are `slice(0, 10)`.
- Slugs are kept **verbatim**; only filename-illegal chars (`\ / : * ? " < > |`
  and control chars) are stripped. Blank slug → `HHmmss` suffix; collisions get
  `-2`, `-3`, …
- Deleting/archiving a post **sets a frontmatter flag** — files never move, links
  never break. "Delete forever" uses `vault.trash` (recoverable), never `vault.delete`.
- Settings operate on the single **active** `postsFolder` (one of `sourceFolders`),
  so all CRUD/listing/watching keeps its single-folder shape.

## Tests

Vitest, in `tests/`, with in-memory vault fakes under `tests/mocks/`. Each pure
module and CRUD path has a matching spec (`frontmatter`, `fileManager`, `filter`,
`stats`, `mediaGrid`, `createPost`, `updatePost`, `deletePost`, `listPosts`,
`watcher`, `settings`, …). Add tests alongside any change to a pure module.

## Data model

```markdown
---
date: 2026-06-12T14:30:22      # creation, set once
updated: 2026-06-12T14:30:22   # bumped on every edit
tags: [idea, todo]             # tags live only in frontmatter
archived: true                 # optional — absent = active
deleted: true                  # optional — shows only in the recycle bin
---

The post body in plain GFM.
```
