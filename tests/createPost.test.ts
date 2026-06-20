import { describe, expect, it } from "vitest";
import { createPost, parseTagInput, type VaultLike } from "../src/fileManager";
import { DEFAULT_SETTINGS } from "../src/types";

function fakeVault() {
  const files = new Map<string, string>();
  const folders = new Set<string>();
  const vault: VaultLike = {
    getAbstractFileByPath: (p) => (files.has(p) || folders.has(p) ? { path: p } : null),
    create: async (p, data) => {
      files.set(p, data);
      return { path: p };
    },
    createFolder: async (p) => {
      folders.add(p);
      return { path: p };
    },
  };
  return { vault, files, folders };
}

const now = new Date(2026, 5, 12, 14, 30, 22);

describe("createPost", () => {
  it("creates exactly one .md in the configured folder with frontmatter and body (AC §2.1)", async () => {
    const { vault, files } = fakeVault();
    const { path } = await createPost(vault, DEFAULT_SETTINGS, {
      body: "My first thought",
      slug: "My First Thought",
      tags: ["idea"],
      now,
    });
    expect(path).toBe("thino/2026-06-12-My First Thought.md");
    expect(files.size).toBe(1);
    const content = files.get(path)!;
    expect(content).toContain("date: 2026-06-12T14:30:22");
    expect(content).not.toContain("updated:");
    expect(content).toContain("tags: [idea]");
    expect(content).toContain("My first thought");
  });

  it("creates the posts folder when missing", async () => {
    const { vault, folders } = fakeVault();
    await createPost(vault, DEFAULT_SETTINGS, { body: "x", slug: "", tags: [], now });
    expect(folders.has("thino")).toBe(true);
  });

  it("does not recreate an existing folder", async () => {
    const { vault, folders } = fakeVault();
    folders.add("thino");
    let created = 0;
    const orig = vault.createFolder;
    vault.createFolder = async (p) => {
      created++;
      return orig(p);
    };
    await createPost(vault, DEFAULT_SETTINGS, { body: "x", slug: "", tags: [], now });
    expect(created).toBe(0);
  });

  it("falls back to HHmmss filename for a blank slug", async () => {
    const { vault } = fakeVault();
    const { path } = await createPost(vault, DEFAULT_SETTINGS, {
      body: "x",
      slug: "",
      tags: [],
      now,
    });
    expect(path).toBe("thino/2026-06-12-143022.md");
  });

  it("suffixes -2 on filename collision", async () => {
    const { vault, files } = fakeVault();
    files.set("thino/2026-06-12-note.md", "taken");
    const { path } = await createPost(vault, DEFAULT_SETTINGS, {
      body: "x",
      slug: "note",
      tags: [],
      now,
    });
    expect(path).toBe("thino/2026-06-12-note-2.md");
  });

  it("rejects a blank slug when requireSlug is on", async () => {
    const { vault } = fakeVault();
    await expect(
      createPost(
        vault,
        { ...DEFAULT_SETTINGS, requireSlug: true },
        { body: "x", slug: "  ", tags: [], now }
      )
    ).rejects.toThrow(/slug/i);
  });

  it("respects a custom posts folder and trims trailing slash", async () => {
    const { vault } = fakeVault();
    const { path } = await createPost(
      vault,
      { ...DEFAULT_SETTINGS, postsFolder: "notes/thino/" },
      { body: "x", slug: "a", tags: [], now }
    );
    expect(path).toBe("notes/thino/2026-06-12-a.md");
  });
});

describe("parseTagInput", () => {
  it("splits on commas and trims", () => {
    expect(parseTagInput(" idea, project ,x ")).toEqual(["idea", "project", "x"]);
  });

  it("drops empties and strips leading #", () => {
    expect(parseTagInput("#idea,, ,#x")).toEqual(["idea", "x"]);
  });

  it("returns [] for blank input", () => {
    expect(parseTagInput("   ")).toEqual([]);
  });
});
