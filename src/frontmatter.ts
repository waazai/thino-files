import type { PostFrontmatter } from "./types";

// Pure frontmatter serializer/parser for the fixed SPEC §3 schema
// (date, updated, tags). The `obsidian` npm package ships types only,
// so parseYaml/stringifyYaml are unavailable under vitest; this module
// stays dependency-free and testable.

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
    `date: ${post.date}\n` +
    `updated: ${post.updated}\n` +
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

export function parsePost(raw: string): PostFrontmatter & { body: string } {
  const empty = { date: "", updated: "", tags: [] as string[], body: raw.replace(/\s+$/, "") };
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return empty;

  const fmLines = m[1].split(/\r?\n/);
  const body = raw.slice(m[0].length).replace(/^\r?\n/, "").replace(/\s+$/, "");
  const result: PostFrontmatter & { body: string } = {
    date: "",
    updated: "",
    tags: [],
    body,
  };

  for (let i = 0; i < fmLines.length; i++) {
    const kv = fmLines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === "date") result.date = unquote(value);
    else if (key === "updated") result.updated = unquote(value);
    else if (key === "tags") result.tags = parseTags(value, fmLines.slice(i + 1));
    else if (key === "archived" && unquote(value) === "true") result.archived = true;
    else if (key === "deleted" && unquote(value) === "true") result.deleted = true;
  }
  return result;
}
