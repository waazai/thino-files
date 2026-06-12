import type { Post } from "./types";

// Client-side filtering over the in-memory post list (SPEC §2.6) — no disk reads.

export interface PostQuery {
  /** Free-text terms; every term must match body or a tag (case-insensitive). */
  text: string[];
  /** #tag filters; every tag must be present on the post. */
  tags: string[];
  /** Inclusive YYYY-MM-DD bounds on the post's date, or null. */
  from: string | null;
  to: string | null;
}

export function parseQuery(input: string): PostQuery {
  const query: PostQuery = { text: [], tags: [], from: null, to: null };
  for (const token of input.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("#") && token.length > 1) {
      query.tags.push(token.slice(1).toLowerCase());
    } else if (token.toLowerCase().startsWith("from:")) {
      query.from = token.slice(5);
    } else if (token.toLowerCase().startsWith("to:")) {
      query.to = token.slice(3);
    } else {
      query.text.push(token.toLowerCase());
    }
  }
  return query;
}

/** List scopes (SPEC §2.C): default timeline, archived box, recycle bin. */
export type PostScope = "timeline" | "archived" | "trash";

export function matchScope(post: Post, scope: PostScope): boolean {
  if (scope === "trash") return post.deleted === true;
  if (scope === "archived") return post.archived === true && !post.deleted;
  return !post.archived && !post.deleted;
}

export function matchPost(post: Post, query: PostQuery): boolean {
  const haystack = `${post.body}\n${post.tags.join("\n")}`.toLowerCase();
  if (!query.text.every((term) => haystack.includes(term))) return false;

  const postTags = post.tags.map((t) => t.toLowerCase());
  if (!query.tags.every((tag) => postTags.includes(tag))) return false;

  const day = post.date.slice(0, 10);
  if (query.from && day < query.from) return false;
  if (query.to && day > query.to) return false;

  return true;
}
