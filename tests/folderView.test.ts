import { describe, expect, it } from "vitest";
import {
  affectsFolder,
  isWithinFolder,
  type ListableVault,
  listPosts,
} from "../src/fileManager";
import { serializePost } from "../src/frontmatter";
import { DEFAULT_SETTINGS } from "../src/types";

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
