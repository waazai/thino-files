# Thino Files

An [Obsidian](https://obsidian.md) plugin, forked from [Quorafind/Obsidian-Thino](https://github.com/Quorafind/Obsidian-Thino).  

## Features

- Each post is a Markdown file.
- Switch between folders to display timelines. 
- Search on text or tag.
- Collapse if post too long.
- Some sid bar stats.
- Media grid view. 
- Recycle bin. 

## File format (If you want to import existing files)

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

## Development

```bash
npm install
npm run dev     # esbuild watch mode
npm run build   # typecheck + production bundle → main.js
npm test        # vitest unit suite
```

For a fast loop, symlink `<vault>/.obsidian/plugins/thino-files` to this repo and reload Obsidian (`Ctrl/Cmd+R`) after changes.
