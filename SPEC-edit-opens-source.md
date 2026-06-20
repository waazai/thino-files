# SPEC — Edit opens source file; drop the `updated` frontmatter field

Focused change spec. Supplements [SPEC.md](SPEC.md) (overrides §2.3 Edit-in-place,
§3 File Format `updated`, §7 testing for those). Does not replace it.

---

## 1. Objective

Remove the in-card inline editor. The card's **Edit** action now opens the post's
underlying `.md` file in Obsidian's native editor — the real editing surface users
already prefer (full CodeMirror, live preview, mobile toolbar). Consolidate the two
redundant "open" affordances into one, and stop maintaining a frontmatter `updated`
field that the UI never reads and that native edits can't reliably bump.

**Why:**
- The cramped inline `<textarea>` reimplements a worse editor; users open the source
  file anyway.
- Removing it dissolves two mobile problems for free: **A1** (back button loses
  unsaved inline-edit text) and **P6** (inline textarea clipped behind the virtual
  keyboard) — see [ANDROID_COMPAT.md](ANDROID_COMPAT.md) / [IPAD_COMPAT.md](IPAD_COMPAT.md).
- `updated` is **written but never read**: cards display `date`, sorting is by `date`.
  Once edits move to the native editor, the plugin can't bump `updated` without
  watcher write-loops. mtime already records "last modified" for free.

**Target users:** unchanged — Obsidian users on desktop, iPadOS, Android.

---

## 2. Core changes & acceptance criteria

### 2.1 Edit icon → open source file

- In **timeline** scope, the pencil (`Edit`) action calls `openPost(post)` instead
  of `enterEditMode()`. Tooltip: `Open source file to edit`.
- The separate `file-symlink` ("Open source file") action is **removed** from the
  timeline scope (the pencil now covers it).
- In **archived** scope, the existing `file-symlink` Open action is replaced by the
  same pencil → `openPost` action, so "open source" is one consistent icon/behavior
  across scopes. (Unarchive and Delete actions unchanged.)
- **Trash** scope is unchanged (Restore + Delete forever; no open action, as today).
- `openPost` behavior is unchanged: opens the file in the active pane (or a new tab
  per `openInNewPane`), cursor at line 1.

**AC:**
- Clicking the pencil on a timeline card focuses that post's `.md` file in an editor
  pane. No inline textarea ever appears.
- No card in any scope shows two separate "open the source file" icons.
- Archived cards can still open their source via the pencil.

### 2.2 Remove the inline editor

- Delete `enterEditMode()` and its textarea/save/cancel UI from `PostCard`.
- Delete the `editing` flag added for A2; `remeasure()` keeps only its
  `isConnected` guard (there is no edit mode left to suppress).
- The `attach` wiring used **only** by the inline editor is removed from `PostCard`
  (the composer keeps its own attachment binding — `media.ts` is untouched).
- `savePost`/`updatePost` are **kept** — the task-checkbox toggle still rewrites the
  file body through them (see §2.3).

**AC:**
- `grep` for `enterEditMode` / `thino-files-card-editor` returns nothing in `src/`.
- Toggling a task checkbox on a card still persists to disk (regression guard).

### 2.3 Drop the `updated` frontmatter field

- Remove `updated` from the `Post` and `PostFrontmatter` types.
- `serializePost` no longer writes an `updated:` line; `parsePost` no longer reads
  one (an `updated:` key in a legacy file is silently ignored, like any unknown key).
- `createPost`, `buildEditedContent`, `buildFlaggedContent`, `updatePost`,
  `setPostFlags` stop setting `updated`. `date` is still set once at creation and
  never changed.
- **"Last edited" source of truth = the file's mtime** (`TFile.stat.mtime`). No
  field is stored. No UI displays it today; a future "edited" chip, if added, reads
  mtime — out of scope here.

**Legacy files:** a file that still contains `updated:` keeps that line until the
plugin next rewrites it (a checkbox toggle, archive, or delete), at which point the
line is dropped. A file only ever edited in the native editor keeps its stale
`updated:` line — harmless, ignored by the parser. No migration pass is run.

**AC:**
- A newly created post's file has frontmatter with `date` and `tags` only — no
  `updated:` line.
- Toggling a checkbox / archiving / deleting rewrites the file with no `updated:`
  line and does not throw on a file that previously had one.
- Sorting and the date chip are unaffected (both already use `date`).

---

## 3. Affected files

| File | Change |
|------|--------|
| `src/PostCard.ts` | Repoint pencil → `openPost`; drop `file-symlink` action; delete `enterEditMode`, `editing` flag, editor `attach` use |
| `src/TimelineView.ts` | No behavior change; `attach` may stay (composer/media grid still use it) — verify it's still needed by the card context, prune if not |
| `src/types.ts` | Remove `updated` from `Post` and `PostFrontmatter` |
| `src/frontmatter.ts` | Drop `updated` from `serializePost`, `parsePost`, the empty-object default |
| `src/fileManager.ts` | Drop `updated` from `createPost`, `buildEditedContent`, `buildFlaggedContent`, `updatePost`, `setPostFlags` |
| `styles.css` | Remove now-dead `.thino-files-card-editor*` rules |
| `tests/*` | Update every assertion referencing `updated` (see §5) |
| `CLAUDE.md` | Update the data-model block and `frontmatter.ts` description to drop `updated` |

---

## 4. Code style & constraints

- Keep the pure/UI split intact: no `obsidian` runtime import added to a pure module.
- Timestamps stay timezone-less local ISO for `date`; `toLocalIso` remains (still used
  for `date`).
- Frontmatter stays hand-rolled and dependency-free; flags still serialized only when
  true so flagged files round-trip minimally.
- No new dependencies. No change to the build.

---

## 5. Testing strategy

Vitest, existing in-memory vault fakes.

- **Update** every spec asserting `updated` to drop it: `frontmatter` (serialize/parse
  round-trip), `createPost`, `updatePost`, `archive`, and any fixture frontmatter.
- **Add** a parse test: a legacy file containing `updated:` parses without error and
  the field is absent from the resulting `Post`.
- **Add** a serialize test: output for a post with flags contains `date` + `tags`
  (+ true flags) and **no** `updated:` line.
- **Regression:** keep the checkbox-toggle-persists test (`updatePost` path) green.
- **Manual smoke (mobile-relevant):**
  - [ ] Tap pencil on a timeline card → source file opens in editor; no inline box.
  - [ ] Archived card pencil → opens source.
  - [ ] No card shows two "open" icons.
  - [ ] Create post → file has no `updated:` line.
  - [ ] Toggle checkbox on a legacy post that had `updated:` → file rewritten without it, toggle persists.

---

## 6. Boundaries

### Always do
- Open the real source file for editing; never reintroduce an inline editor.
- Keep `date` immutable after creation.
- Keep `updatePost`/`setPostFlags` working for the checkbox and flag paths.

### Ask first
- Adding an mtime-based "edited" chip to the card (new display surface — separate change).
- Any migration pass that rewrites existing files to strip `updated:` in bulk.

### Never do
- Auto-bump any timestamp from the vault watcher (write-loop / editor-fight risk).
- Move or rename post files on edit (links must stay stable).
- Break GFM round-tripping of the frontmatter for legacy files.
