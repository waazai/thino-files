import { describe, expect, it } from "vitest";
import { buildEditedContent, updatePost, type ModifiableVault } from "../src/fileManager";
import { parsePost } from "../src/frontmatter";
import type { Post } from "../src/types";

const post: Post = {
  path: "thino/2026-06-10-a.md",
  created: "2026-06-10T08:00:00",
  tags: ["idea"],
  body: "original body",
};

describe("buildEditedContent", () => {
  it("rewrites body while preserving created and tags, without an updated field (AC §2.3)", () => {
    const content = buildEditedContent(post, "new body");
    const parsed = parsePost(content);
    expect(parsed.body).toBe("new body");
    expect(parsed.created).toBe("2026-06-10T08:00:00");
    expect(content).not.toContain("updated:");
    expect(parsed.tags).toEqual(["idea"]);
  });
});

describe("updatePost", () => {
  it("writes the edited content to the existing file via vault.modify", async () => {
    const writes: Record<string, string> = {};
    const vault: ModifiableVault = {
      getAbstractFileByPath: (p) =>
        p === post.path ? { path: p } : null,
      modify: async (file, data) => {
        writes[(file as { path: string }).path] = data;
      },
    };
    const result = await updatePost(vault, post, "edited!");
    expect(Object.keys(writes)).toEqual([post.path]);
    expect(writes[post.path]).toContain("edited!");
    expect(result.body).toBe("edited!");
  });

  it("throws when the file vanished", async () => {
    const vault: ModifiableVault = {
      getAbstractFileByPath: () => null,
      modify: async () => {},
    };
    await expect(updatePost(vault, post, "x")).rejects.toThrow(/not found/i);
  });
});
