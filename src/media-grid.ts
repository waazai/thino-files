// Pure image-embed extraction for the Media grid scope (SPEC §2.F). No
// `obsidian` import so it loads under vitest; path→resource resolution and DOM
// live in TimelineView.

const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp",
]);

/** Markdown image: `![alt](target)`. Wiki embed: `![[target]]`. */
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)]+)\)/g;
const WIKI_EMBED = /!\[\[([^\]]+)\]\]/g;

function hasImageExt(target: string): boolean {
  // Strip a trailing `#anchor` (block/heading ref) before reading the extension.
  const clean = target.split("#")[0];
  const dot = clean.lastIndexOf(".");
  if (dot < 0) return false;
  return IMAGE_EXTS.has(clean.slice(dot + 1).toLowerCase());
}

/** Markdown link targets may carry a `"title"` after the URL — drop it. */
function stripMarkdownTitle(target: string): string {
  return target.trim().replace(/\s+["'].*["']$/, "").trim();
}

/** Wiki embeds may carry `|alias` and `#anchor` — keep only the link path. */
function stripWikiAlias(target: string): string {
  return target.split("|")[0].split("#")[0].trim();
}

/**
 * All image embeds in a post body, in order of appearance (AC §F.2, F.5). One
 * entry per occurrence; returns the raw link target (path or wiki linkpath,
 * with `#anchor`/`|alias`/`"title"` removed) for later vault resolution.
 * Non-image links and bare `[[note]]` links are ignored.
 */
export function extractImageEmbeds(body: string): string[] {
  const found: { index: number; target: string }[] = [];

  for (const m of body.matchAll(MARKDOWN_IMAGE)) {
    const target = stripMarkdownTitle(m[1]);
    if (hasImageExt(target)) {
      found.push({ index: m.index ?? 0, target });
    }
  }
  for (const m of body.matchAll(WIKI_EMBED)) {
    const target = stripWikiAlias(m[1]);
    if (hasImageExt(target)) {
      found.push({ index: m.index ?? 0, target });
    }
  }

  return found.sort((a, b) => a.index - b.index).map((e) => e.target);
}
