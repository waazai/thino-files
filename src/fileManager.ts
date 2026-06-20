// Filename/date helpers + vault-bound CRUD. Vault access goes through the
// narrow VaultLike interface so unit tests can substitute an in-memory fake;
// keep `obsidian` imports type-only so this module loads under vitest.

import { parsePost, serializePost, toLocalIso } from "./frontmatter";
import type { Post, ThinoFilesSettings } from "./types";

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Keep the user's slug verbatim, normalizing silently only where a filename
 * demands it: strip characters illegal in a filename (`\ / : * ? " < > |` and
 * ASCII control chars) and trim leading/trailing whitespace. Case, internal
 * spaces, punctuation, and Unicode are preserved. Returns "" when nothing
 * usable remains, so callers apply their blank-slug fallback.
 */
export function sanitizeSlug(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").trim();
}

/**
 * Tri-state overflow decision for the collapsible card body (§M.8a), from the
 * body's measured `scrollHeight`/`clientHeight`:
 *   - `true`  — content overflows the clamp → a Show more toggle is needed;
 *   - `false` — content fits → no clamp, no toggle;
 *   - `null`  — **unmeasurable**: the element is not laid out (detached or a
 *     hidden leaf, the "jump to source file → back" case), so `clientHeight`
 *     reads 0. The caller must keep the body clamped and re-measure once it
 *     becomes visible — treating this as "fits" would wrongly expand the card.
 */
export function overflowState(
  scrollHeight: number,
  clientHeight: number
): boolean | null {
  if (clientHeight === 0) return null;
  return scrollHeight > clientHeight;
}

/** Tiny token formatter supporting YYYY, MM, DD, HH, mm, ss. */
export function formatDate(d: Date, format: string): string {
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()));
}

/**
 * `{date}-{slug}.md`; blank slug falls back to HHmmss; collisions get
 * -2, -3, … via the `exists` probe.
 */
export function buildFilename(
  date: Date,
  slug: string,
  exists: (name: string) => boolean,
  dateFormat = "YYYY-MM-DD"
): string {
  const clean = sanitizeSlug(slug);
  const base = `${formatDate(date, dateFormat)}-${clean || formatDate(date, "HHmmss")}`;
  let candidate = `${base}.md`;
  for (let n = 2; exists(candidate); n++) {
    candidate = `${base}-${n}.md`;
  }
  return candidate;
}

/**
 * Recover the user's slug from a post path for the card title (AC §M.9).
 * Strips the `{date}-` prefix (reproduced from the post's own date + the
 * configured filename format), then returns the remainder verbatim — no
 * humanizing. The blank-slug fallback (HHmmss, optionally with a `-N`
 * collision suffix) is treated as "no slug" and returns "".
 */
export function postSlug(
  path: string,
  isoDate: string,
  dateFormat = "YYYY-MM-DD"
): string {
  const base = (path.split("/").pop() ?? "").replace(/\.md$/i, "");
  const d = new Date(isoDate);
  const prefix = isNaN(d.getTime()) ? "" : `${formatDate(d, dateFormat)}-`;
  const rest = prefix && base.startsWith(prefix) ? base.slice(prefix.length) : base;
  // HHmmss fallback (6 digits, maybe a collision suffix) means no real slug.
  if (/^\d{6}(-\d+)?$/.test(rest)) return "";
  return rest;
}

/** Comma-separated tag input → clean tag list (leading # stripped). */
export function parseTagInput(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim().replace(/^#+/, ""))
    .filter(Boolean);
}

/** Subset of Obsidian's Vault used by this plugin — fakeable in tests. */
export interface VaultLike {
  getAbstractFileByPath(path: string): unknown;
  create(path: string, data: string): Promise<unknown>;
  createFolder(path: string): Promise<unknown>;
}

export interface CreatePostInput {
  body: string;
  slug: string;
  tags: string[];
  /** Injectable clock for tests; defaults to new Date(). */
  now?: Date;
}

export function normalizeFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, "");
}

export async function createPost(
  vault: VaultLike,
  settings: ThinoFilesSettings,
  input: CreatePostInput
): Promise<{ file: unknown; path: string; content: string }> {
  if (settings.requireSlug && !sanitizeSlug(input.slug)) {
    throw new Error("A slug is required to post.");
  }
  const now = input.now ?? new Date();
  const folder = normalizeFolder(settings.postsFolder);
  if (folder && !vault.getAbstractFileByPath(folder)) {
    await vault.createFolder(folder);
  }
  const toPath = (name: string): string => (folder ? `${folder}/${name}` : name);
  const name = buildFilename(
    now,
    input.slug,
    (n) => Boolean(vault.getAbstractFileByPath(toPath(n))),
    settings.filenameDateFormat
  );
  const content = serializePost({
    date: toLocalIso(now),
    tags: input.tags,
    body: input.body,
  });
  const path = toPath(name);
  const file = await vault.create(path, content);
  return { file, path, content };
}

/** Vault subset needed to rewrite an existing post. */
export interface ModifiableVault {
  getAbstractFileByPath(path: string): unknown;
  modify(file: unknown, data: string): Promise<void>;
}

/** New file content for an edit: body replaced, `date`/tags kept. */
export function buildEditedContent(post: Post, newBody: string): string {
  return serializePost({
    date: post.date,
    tags: post.tags,
    body: newBody,
  });
}

export async function updatePost(
  vault: ModifiableVault,
  post: Post,
  newBody: string
): Promise<Post> {
  const file = vault.getAbstractFileByPath(post.path);
  if (!file) throw new Error(`File not found: ${post.path}`);
  await vault.modify(file, buildEditedContent(post, newBody));
  return { ...post, body: newBody };
}

/** Soft-state flags edited by archive/restore/delete actions (SPEC §2.C). */
export interface PostFlags {
  archived?: boolean;
  deleted?: boolean;
}

/** New file content with flags applied — body/date/tags kept. */
export function buildFlaggedContent(post: Post, flags: PostFlags): string {
  return serializePost({
    date: post.date,
    tags: post.tags,
    archived: flags.archived ?? post.archived,
    deleted: flags.deleted ?? post.deleted,
    body: post.body,
  });
}

/**
 * Archive/unarchive/restore/soft-delete all funnel through here. Returns the
 * updated post with cleared flags removed (absent = active, AC §C.1).
 */
export async function setPostFlags(
  vault: ModifiableVault,
  post: Post,
  flags: PostFlags
): Promise<Post> {
  const file = vault.getAbstractFileByPath(post.path);
  if (!file) throw new Error(`File not found: ${post.path}`);
  await vault.modify(file, buildFlaggedContent(post, flags));
  const result: Post = { ...post, ...flags };
  if (!result.archived) delete result.archived;
  if (!result.deleted) delete result.deleted;
  return result;
}

const TASK_LINE = /^(\s*[-*+]\s+\[)([ xX])(\])/;

/**
 * Flip the nth task checkbox (render order) in a post body. Returns the new
 * body, or null when fewer than n+1 task lines exist.
 */
export function toggleTaskInBody(body: string, taskIndex: number): string | null {
  const lines = body.split("\n");
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TASK_LINE);
    if (!m) continue;
    if (seen === taskIndex) {
      const flipped = m[2] === " " ? "x" : " ";
      lines[i] = lines[i].replace(TASK_LINE, `$1${flipped}$3`);
      return lines.join("\n");
    }
    seen++;
  }
  return null;
}

/** Vault subset needed to trash a post. */
export interface TrashableVault {
  getAbstractFileByPath(path: string): unknown;
  trash(file: unknown, system: boolean): Promise<void>;
}

/**
 * Move a post to trash. Always `vault.trash` — never `vault.delete` — so the
 * file stays recoverable (SPEC §8). `system: true` respects the user's
 * Obsidian trash preference.
 */
export async function deletePost(vault: TrashableVault, path: string): Promise<void> {
  const file = vault.getAbstractFileByPath(path);
  if (!file) return;
  await vault.trash(file, true);
}

/** Vault subset needed to list and read posts. */
export interface ListableVault {
  getMarkdownFiles(): { path: string }[];
  cachedRead(file: { path: string }): Promise<string>;
}

/** True when `path` lives anywhere under `folder` (any depth, AC §D.2). */
export function isWithinFolder(folder: string, path: string): boolean {
  return path.startsWith(`${folder}/`);
}

/**
 * True when a vault event for `path` (or a rename from `oldPath`) touches a
 * .md anywhere under the posts folder — the watcher's refresh predicate.
 * An empty folder setting still means vault root only (never the whole vault).
 */
export function affectsFolder(
  folder: string,
  path: string,
  oldPath?: string
): boolean {
  const hits = (p: string): boolean =>
    p.endsWith(".md") && (folder ? isWithinFolder(folder, p) : !p.includes("/"));
  return hits(path) || (oldPath !== undefined && hits(oldPath));
}

/**
 * Read every .md under the configured folder (recursive, assets folder
 * excluded), parse frontmatter, sort by `date` descending.
 */
export async function listPosts(
  vault: ListableVault,
  settings: ThinoFilesSettings
): Promise<Post[]> {
  const folder = normalizeFolder(settings.postsFolder);
  const assets = normalizeFolder(settings.assetsFolder);
  const files = vault
    .getMarkdownFiles()
    .filter((f) => (folder ? isWithinFolder(folder, f.path) : !f.path.includes("/")))
    .filter((f) => !assets || !isWithinFolder(assets, f.path));
  const posts = await Promise.all(
    files.map(async (f): Promise<Post> => {
      const raw = await vault.cachedRead(f);
      return { path: f.path, ...parsePost(raw) };
    })
  );
  // ISO 8601 strings sort lexicographically; empty dates sink to the bottom.
  return posts.sort((a, b) => {
    if (a.date === b.date) return a.path.localeCompare(b.path);
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"]);

/**
 * `YYYYMMDD-HHmmss-{sanitized}.{ext}` for a pasted/dropped file; collisions
 * get -2, -3, … via the `exists` probe — an asset is never overwritten
 * (AC §B.2, B.4).
 */
export function buildAssetFilename(
  date: Date,
  originalName: string,
  exists: (name: string) => boolean
): string {
  const dot = originalName.lastIndexOf(".");
  const stem = dot > 0 ? originalName.slice(0, dot) : originalName;
  const ext = dot > 0 ? originalName.slice(dot + 1).toLowerCase() : "";
  const base = `${formatDate(date, "YYYYMMDD-HHmmss")}-${sanitizeSlug(stem) || "file"}`;
  const withExt = (b: string): string => (ext ? `${b}.${ext}` : b);
  let candidate = withExt(base);
  for (let n = 2; exists(candidate); n++) {
    candidate = withExt(`${base}-${n}`);
  }
  return candidate;
}

/** `![name](path)` for images, `[name](path)` otherwise; spaces encoded. */
export function buildMarkdownLink(name: string, path: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const bang = IMAGE_EXTS.has(ext) ? "!" : "";
  return `${bang}[${name}](${path.replace(/ /g, "%20")})`;
}

/** Vault subset needed to store a binary attachment. */
export interface AssetVault {
  getAbstractFileByPath(path: string): unknown;
  createFolder(path: string): Promise<unknown>;
  createBinary(path: string, data: ArrayBuffer): Promise<unknown>;
}

/** Write a pasted/dropped binary into the assets folder; returns its path. */
export async function saveAsset(
  vault: AssetVault,
  settings: ThinoFilesSettings,
  originalName: string,
  data: ArrayBuffer,
  now: Date = new Date()
): Promise<string> {
  const folder = normalizeFolder(settings.assetsFolder);
  if (folder && !vault.getAbstractFileByPath(folder)) {
    await vault.createFolder(folder);
  }
  const toPath = (name: string): string => (folder ? `${folder}/${name}` : name);
  const name = buildAssetFilename(now, originalName, (n) =>
    Boolean(vault.getAbstractFileByPath(toPath(n)))
  );
  const path = toPath(name);
  await vault.createBinary(path, data);
  return path;
}

/** Splice `text` into `value` at `cursor`; returns the new value and cursor. */
export function insertAtCursor(
  value: string,
  cursor: number,
  text: string
): { value: string; cursor: number } {
  return {
    value: value.slice(0, cursor) + text + value.slice(cursor),
    cursor: cursor + text.length,
  };
}

