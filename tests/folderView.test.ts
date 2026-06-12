import { describe, expect, it } from "vitest";
import {
  affectsFolder,
  groupByFolder,
  isWithinFolder,
  type ListableVault,
  listPosts,
} from "../src/fileManager";
import { serializePost } from "../src/frontmatter";
import { DEFAULT_SETTINGS, type Post } from "../src/types";

const post = (path: string, date: string): Post => ({
  path,
  date,
  updated: date,
  tags: [],
  body: "x",
});

function fakeVault(paths: string[]): ListableVault {
  return {
    getMarkdownFiles: () => paths.map((path) => ({ path })),
    cachedRead: async (f) =>
      serializePost({
        date: "2026-06-01T10:00:00",
        updated: "2026-06-01T10:00:00",
        tags: [],
        body: f.path,
      }),
  };
}

describe("isWithinFolder", () => {
  it("matches any depth under the folder", () => {
    expect(isWithinFolder("thino", "thino/a.md")).toBe(true);
    expect(isWithinFolder("thino", "thino/projects/deep/a.md")).toBe(true);
    expect(isWithinFolder("thino", "other/a.md")).toBe(false);
    expect(isWithinFolder("thino", "thinox/a.md")).toBe(false);
  });
});

describe("listPosts — recursive (AC §D.2)", () => {
  const settings = { ...DEFAULT_SETTINGS, postsFolder: "thino" };

  it("includes posts in subfolders", async () => {
    const posts = await listPosts(
      fakeVault(["thino/a.md", "thino/projects/b.md", "elsewhere/c.md"]),
      settings
    );
    expect(posts.map((p) => p.path).sort()).toEqual([
      "thino/a.md",
      "thino/projects/b.md",
    ]);
  });

  it("excludes the assets folder", async () => {
    const posts = await listPosts(
      fakeVault(["thino/a.md", "thino/assets/note.md"]),
      { ...settings, assetsFolder: "thino/assets" }
    );
    expect(posts.map((p) => p.path)).toEqual(["thino/a.md"]);
  });
});

describe("affectsFolder — recursive watcher predicate", () => {
  it("fires for subfolder markdown changes", () => {
    expect(affectsFolder("thino", "thino/projects/b.md")).toBe(true);
    expect(affectsFolder("thino", "elsewhere/b.md")).toBe(false);
    expect(affectsFolder("thino", "thino/img.png")).toBe(false);
  });
});

describe("groupByFolder (AC §D.3)", () => {
  it("groups by first segment under the posts folder; direct children under folder name", () => {
    const groups = groupByFolder(
      [
        post("thino/work/deep/b.md", "2026-06-03T10:00:00"),
        post("thino/a.md", "2026-06-02T10:00:00"),
        post("thino/ideas/c.md", "2026-06-01T10:00:00"),
        post("thino/ideas/d.md", "2026-06-04T10:00:00"),
      ],
      "thino"
    );
    expect(groups.map((g) => g.name)).toEqual(["ideas", "thino", "work"]);
    expect(groups[0].posts.map((p) => p.path)).toEqual([
      "thino/ideas/c.md",
      "thino/ideas/d.md",
    ]);
  });

  it("preserves input post order within groups (newest first upstream)", () => {
    const groups = groupByFolder(
      [post("thino/g/new.md", "2026-06-05T10:00:00"), post("thino/g/old.md", "2026-06-01T10:00:00")],
      "thino"
    );
    expect(groups[0].posts.map((p) => p.path)).toEqual([
      "thino/g/new.md",
      "thino/g/old.md",
    ]);
  });
});
