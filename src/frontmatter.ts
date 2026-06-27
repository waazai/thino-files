import type { PostFrontmatter } from "./types";

// Pure frontmatter serializer/parser for the fixed SPEC §3 schema
// (created, tags). The `obsidian` npm package ships types only,
// so parseYaml/stringifyYaml are unavailable under vitest; this module
// stays dependency-free and testable.
//
// The creation timestamp is serialized as `created:`. On parse the value is
// resolved with a fallback chain so imported / legacy files keep their date:
// `created:` → legacy `date:` → the first other property whose value looks like
// a date. Whatever is found is rewritten as `created:` the next time the plugin
// saves the file.
//
// "Last edited" is the file's mtime, not a frontmatter field — there is no
// `updated` key. A legacy `updated:` line is ignored on parse and dropped the
// next time the plugin rewrites the file.

const pad = (n: number): string => String(n).padStart(2, "0");

/** Local-time ISO 8601 without timezone suffix, e.g. 2026-06-12T14:30:22. */
export function toLocalIso(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export function serializePost(post: PostFrontmatter & { body: string }): string {
  return (
    "---\n" +
    `created: ${post.created}\n` +
    `tags: [${post.tags.join(", ")}]\n` +
    // Flags appear only when set — legacy files stay byte-identical (AC §C.1).
    (post.archived ? "archived: true\n" : "") +
    (post.deleted ? "deleted: true\n" : "") +
    "---\n\n" +
    `${post.body.replace(/\s+$/, "")}\n`
  );
}

function unquote(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function parseTags(value: string, followingLines: string[]): string[] {
  const inline = value.trim();
  if (inline.startsWith("[")) {
    const inner = inline.replace(/^\[/, "").replace(/\]$/, "").trim();
    if (!inner) return [];
    return inner.split(",").map((t) => unquote(t)).filter(Boolean);
  }
  if (inline === "") {
    // Dash-list form on the following lines.
    const tags: string[] = [];
    for (const line of followingLines) {
      const m = line.match(/^\s*-\s*(.+)$/);
      if (!m) break;
      tags.push(unquote(m[1]));
    }
    return tags;
  }
  return inline ? [unquote(inline)] : [];
}

/** A YAML scalar looks like a date when it starts with an ISO `YYYY-MM-DD`
 * (optionally followed by a `T`/space time) and parses to a real instant. */
function looksLikeDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(value)) return false;
  return !isNaN(new Date(value).getTime());
}

export function parsePost(raw: string): PostFrontmatter & { body: string } {
  const empty = { created: "", tags: [] as string[], body: raw.replace(/\s+$/, "") };
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return empty;

  const fmLines = m[1].split(/\r?\n/);
  const body = raw.slice(m[0].length).replace(/^\r?\n/, "").replace(/\s+$/, "");
  const result: PostFrontmatter & { body: string } = {
    created: "",
    tags: [],
    body,
  };

  // Resolved after the loop: prefer `created`, then legacy `date`, then the
  // first other date-valued property, so imported files keep their timestamp.
  let createdVal = "";
  let legacyDateVal = "";
  let firstDateProp = "";

  for (let i = 0; i < fmLines.length; i++) {
    const kv = fmLines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === "created") createdVal = unquote(value);
    else if (key === "date") legacyDateVal = unquote(value);
    else if (key === "tags") result.tags = parseTags(value, fmLines.slice(i + 1));
    else if (key === "archived" && unquote(value) === "true") result.archived = true;
    else if (key === "deleted" && unquote(value) === "true") result.deleted = true;
    else if (!firstDateProp && looksLikeDate(unquote(value))) {
      firstDateProp = unquote(value);
    }
  }
  result.created = createdVal || legacyDateVal || firstDateProp;
  return result;
}
