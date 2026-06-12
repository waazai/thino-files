# Thino Files

An [Obsidian](https://obsidian.md) plugin with a Twitter-style timeline where **every post is its own Markdown file**. Instead of appending thoughts to a daily note, each capture becomes an atomic `.md` file with YAML frontmatter — so Obsidian search, backlinks, and graph view work per-thought, and posts render as plain GFM anywhere (GitHub, VS Code, any Markdown viewer).

## Features

- **Quick capture** — compose box at the top of the timeline; post with the button or `Cmd/Ctrl+Enter`. Optional title/slug and comma-separated tags.
- **One file per post** — files land in a configurable folder (default `thino/`) as `YYYY-MM-DD-{slug}.md`; a blank slug falls back to a `HHmmss` time suffix, and name collisions get `-2`, `-3`, …
- **Timeline view** — newest-first cards with a date chip, tag pills, and the GFM-rendered body. Reads the configured folder (subfolders included), never the whole vault.
- **Folder view** — toggle in the header switches to cards grouped under collapsible per-subfolder headers; the choice persists.
- **Sidebar** — status counters (posts / tags / active days), a 12-week activity heatmap, and a month calendar; clicking a day filters the list (click again to clear). Collapses automatically in narrow panes.
- **Archive & recycle bin** — archiving or deleting a post only sets an `archived:`/`deleted:` frontmatter flag, so files never move and links never break. Sidebar scopes switch between Timeline, Archived, and Recycle bin; the bin offers restore and a confirmed "delete forever" (`vault.trash`).
- **Media attachments** — paste or drop a file into the compose box or a card editor; the binary is saved to a configurable assets folder and `![name](path)` / `[name](path)` is inserted at the cursor. Existing assets are never overwritten.
- **Live refresh** — files added, changed, or removed outside the plugin show up within ~2 s (debounced vault watcher).
- **Card actions** — edit in place (`Cmd/Ctrl+Enter` saves and bumps `updated`, `Esc` cancels), open the source file (cursor at line 1), archive, delete to the recycle bin with confirmation.
- **Interactive tasks** — `- [ ]` checkboxes in a post are clickable and rewrite the underlying file line.
- **Filter bar** — free text, `#tag`, and `from:YYYY-MM-DD to:YYYY-MM-DD` date ranges; press `Enter` to pin a query as a removable chip. Composes with the calendar day filter. All filtering is client-side.

## File format

```markdown
---
date: 2026-06-12T14:30:22
updated: 2026-06-12T14:30:22
tags: [idea, project]
---

Post body goes here. Full **GFM** supported.

- [ ] A task item
```

- `date` — creation timestamp, set once.
- `updated` — bumped on every edit (including checkbox toggles).
- `tags` — live only in frontmatter; inline `#hashtags` in the body are treated as plain content.
- `archived` / `deleted` — optional `true` flags set by the archive/delete actions; absent means active, so v0.1.0 files need no migration.

## Installation (manual)

1. Build (see below) or grab `main.js`, `manifest.json`, `styles.css`.
2. Copy the three files into `<your-vault>/.obsidian/plugins/thino-files/`.
3. In Obsidian: **Settings → Community plugins** → disable Restricted mode → enable **Thino Files**.
4. Open the timeline from the ribbon icon or the command palette ("Thino Files: Open timeline").

## Settings

| Setting | Default | Effect |
|---|---|---|
| Posts folder | `thino` | Folder the timeline reads from and posts into |
| Assets folder | `thino/assets` | Where pasted/dropped media is stored; excluded from the timeline |
| Filename date format | `YYYY-MM-DD` | Date prefix for new filenames |
| Require slug on post | off | Block posting until a slug is entered |
| Open in new pane | off | Open source files in a new tab |
| Date display format | `YYYY-MM-DD HH:mm` | Card date chip format |

## Development

```bash
npm install
npm run dev     # esbuild watch mode
npm run build   # typecheck + production bundle → main.js
npm test        # vitest unit suite
```

For a fast loop, symlink `<vault>/.obsidian/plugins/thino-files` to this repo and reload Obsidian (`Ctrl/Cmd+R`) after changes.

### Code layout

| Module | Responsibility |
|---|---|
| `src/main.ts` | Plugin entry — view/command/settings registration |
| `src/TimelineView.ts` | Timeline leaf: layout, composer + filter bar + card list/groups, scopes, vault watcher |
| `src/Sidebar.ts` | Status counters, heatmap, month calendar, scope switcher |
| `src/stats.ts` | Pure aggregation: posts per day, counters, heatmap buckets, calendar grid |
| `src/PostCard.ts` | One card: render, edit mode, scope-dependent actions, checkbox binding |
| `src/Composer.ts` / `src/FilterBar.ts` | Top compose box / filter input + chips |
| `src/media.ts` | Paste/drop binding for textareas → save asset, insert link |
| `src/fileManager.ts` | Filename/slug/asset helpers + create/list/update/flag/trash via narrow vault interfaces |
| `src/frontmatter.ts` | Dependency-free YAML frontmatter serialize/parse (fixed schema) |
| `src/filter.ts` | `parseQuery` / `matchPost` query logic |
| `src/settings.ts` | Settings tab + type-checked settings merge |

Pure logic is kept free of `obsidian` imports (the npm package is types-only), so the unit suite runs without the app; vault operations go through small interfaces faked in `tests/`.

## License

MIT
