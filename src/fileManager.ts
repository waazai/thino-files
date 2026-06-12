// Filename/date helpers + vault-bound CRUD. Vault access goes through the
// narrow VaultLike interface so unit tests can substitute an in-memory fake;
// keep `obsidian` imports type-only so this module loads under vitest.

import { serializePost, toLocalIso } from "./frontmatter";
import type { ThinoFilesSettings } from "./types";

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Filename-safe slug: spaces → '-', strip illegal characters, collapse
 * repeated hyphens, trim edge hyphens, lowercase.
 */
export function sanitizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
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
  const iso = toLocalIso(now);
  const content = serializePost({
    date: iso,
    updated: iso,
    tags: input.tags,
    body: input.body,
  });
  const path = toPath(name);
  const file = await vault.create(path, content);
  return { file, path, content };
}
