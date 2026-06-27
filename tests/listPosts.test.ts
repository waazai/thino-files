import { describe, expect, it } from "vitest";
import { listPosts, sortPosts, type ListableVault } from "../src/fileManager";
import { serializePost } from "../src/frontmatter";
import { DEFAULT_SETTINGS, type Post } from "../src/types";

function fakeVault(files: Record<string, string>): ListableVault {
  return {
    getMarkdownFiles: () =>
      Object.keys(files)
        .filter((p) => p.endsWith(".md"))
        .map((path) => ({ path })),
    cachedRead: async (file) => files[file.path],
  };
}

const post = (date: string, body: string, tags: string[] = []) =>
  serializePost({ date, tags, body });

describe("listPosts", () => {
  it("reads only the configured folder, sorted by date descending (AC §2.2)", async () => {
    const vault = fakeVault({
      "thino/2026-06-10-old.md": post("2026-06-10T08:00:00", "old"),
      "thino/2026-06-12-new.md": post("2026-06-12T09:00:00", "new"),
      "thino/2026-06-11-mid.md": post("2026-06-11T10:00:00", "mid"),
      "elsewhere/2026-06-13-x.md": post("2026-06-13T00:00:00", "outside"),
      "root-note.md": post("2026-06-14T00:00:00", "root"),
    });
    const posts = await listPosts(vault, DEFAULT_SETTINGS);
    expect(posts.map((p) => p.body)).toEqual(["new", "mid", "old"]);
    expect(posts.map((p) => p.path)).toEqual([
      "thino/2026-06-12-new.md",
      "thino/2026-06-11-mid.md",
      "thino/2026-06-10-old.md",
    ]);
  });

  it("includes files in subfolders of the posts folder (AC §D.2)", async () => {
    const vault = fakeVault({
      "thino/2026-06-12-a.md": post("2026-06-12T01:00:00", "a"),
      "thino/sub/2026-06-12-b.md": post("2026-06-12T02:00:00", "b"),
    });
    const posts = await listPosts(vault, DEFAULT_SETTINGS);
    expect(posts.map((p) => p.body)).toEqual(["b", "a"]);
  });

  it("parses tags and date from frontmatter", async () => {
    const vault = fakeVault({
      "thino/2026-06-12-a.md": post("2026-06-12T01:00:00", "a", ["idea", "x"]),
    });
    const [p] = await listPosts(vault, DEFAULT_SETTINGS);
    expect(p.tags).toEqual(["idea", "x"]);
    expect(p.date).toBe("2026-06-12T01:00:00");
  });

  it("sorts frontmatter-less files last instead of crashing", async () => {
    const vault = fakeVault({
      "thino/plain.md": "no frontmatter here",
      "thino/2026-06-12-a.md": post("2026-06-12T01:00:00", "a"),
    });
    const posts = await listPosts(vault, DEFAULT_SETTINGS);
    expect(posts.map((p) => p.body)).toEqual(["a", "no frontmatter here"]);
  });

  it("returns [] for an empty or missing folder", async () => {
    const posts = await listPosts(fakeVault({}), DEFAULT_SETTINGS);
    expect(posts).toEqual([]);
  });

  it("honors settings.sortOrder = asc (oldest first)", async () => {
    const vault = fakeVault({
      "thino/2026-06-10-old.md": post("2026-06-10T08:00:00", "old"),
      "thino/2026-06-12-new.md": post("2026-06-12T09:00:00", "new"),
      "thino/2026-06-11-mid.md": post("2026-06-11T10:00:00", "mid"),
    });
    const posts = await listPosts(vault, { ...DEFAULT_SETTINGS, sortOrder: "asc" });
    expect(posts.map((p) => p.body)).toEqual(["old", "mid", "new"]);
  });
});

describe("sortPosts", () => {
  const p = (date: string, path: string): Post => ({ date, path, tags: [], body: "" });

  it("defaults to newest-first, undated last, path-stable ties", () => {
    const sorted = sortPosts([
      p("", "thino/z.md"),
      p("2026-06-10T08:00:00", "thino/b.md"),
      p("2026-06-12T09:00:00", "thino/a.md"),
      p("2026-06-10T08:00:00", "thino/a.md"),
    ]);
    expect(sorted.map((x) => x.path)).toEqual([
      "thino/a.md", // newest
      "thino/a.md", // same date as b → path tiebreak
      "thino/b.md",
      "thino/z.md", // undated sinks to bottom
    ]);
  });

  it("reverses to oldest-first for asc, but keeps undated at the bottom", () => {
    const sorted = sortPosts(
      [
        p("", "thino/z.md"),
        p("2026-06-12T09:00:00", "thino/new.md"),
        p("2026-06-10T08:00:00", "thino/old.md"),
      ],
      "asc"
    );
    expect(sorted.map((x) => x.path)).toEqual([
      "thino/old.md",
      "thino/new.md",
      "thino/z.md", // undated still last regardless of order
    ]);
  });
});
