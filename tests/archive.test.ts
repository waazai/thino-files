import { describe, expect, it } from "vitest";
import {
  buildFlaggedContent,
  type ModifiableVault,
  setPostFlags,
} from "../src/fileManager";
import { parsePost, serializePost } from "../src/frontmatter";
import { matchScope } from "../src/filter";
import type { Post } from "../src/types";

const base: Post = {
  path: "thino/2026-06-12-a.md",
  created: "2026-06-12T10:00:00",
  tags: ["idea"],
  body: "Hello",
};

describe("frontmatter flags (AC §C.1)", () => {
  it("round-trips archived and deleted flags", () => {
    const raw = serializePost({ ...base, archived: true, deleted: true });
    const parsed = parsePost(raw);
    expect(parsed.archived).toBe(true);
    expect(parsed.deleted).toBe(true);
  });

  it("omits flags from output when false or absent", () => {
    expect(serializePost({ ...base })).not.toMatch(/archived|deleted/);
    expect(serializePost({ ...base, archived: false, deleted: false })).not.toMatch(
      /archived|deleted/
    );
  });

  it("parses legacy files without flags as active", () => {
    const parsed = parsePost(serializePost({ ...base }));
    expect(parsed.archived).toBeUndefined();
    expect(parsed.deleted).toBeUndefined();
  });
});

describe("buildFlaggedContent", () => {
  it("sets a flag, preserves created/tags/body, writes no updated field", () => {
    const content = buildFlaggedContent(base, { archived: true });
    const parsed = parsePost(content);
    expect(parsed.archived).toBe(true);
    expect(content).not.toContain("updated:");
    expect(parsed.created).toBe(base.created);
    expect(parsed.tags).toEqual(base.tags);
    expect(parsed.body).toBe(base.body);
  });

  it("clears a flag while keeping the other", () => {
    const post: Post = { ...base, archived: true, deleted: true };
    const parsed = parsePost(buildFlaggedContent(post, { deleted: false }));
    expect(parsed.deleted).toBeUndefined();
    expect(parsed.archived).toBe(true);
  });
});

describe("setPostFlags", () => {
  it("writes flagged content and returns the updated post", async () => {
    const writes: string[] = [];
    const vault: ModifiableVault = {
      getAbstractFileByPath: (p) => ({ path: p }),
      modify: async (_f, data) => {
        writes.push(data);
      },
    };
    const result = await setPostFlags(vault, base, { deleted: true });
    expect(writes).toHaveLength(1);
    expect(parsePost(writes[0]).deleted).toBe(true);
    expect(result.deleted).toBe(true);
  });

  it("drops cleared flags from the returned post (absent = active)", async () => {
    const vault: ModifiableVault = {
      getAbstractFileByPath: (p) => ({ path: p }),
      modify: async () => {},
    };
    const result = await setPostFlags(
      vault,
      { ...base, archived: true },
      { archived: false }
    );
    expect("archived" in result).toBe(false);
  });

  it("throws when the file is missing", async () => {
    const vault: ModifiableVault = {
      getAbstractFileByPath: () => null,
      modify: async () => {},
    };
    await expect(setPostFlags(vault, base, { archived: true })).rejects.toThrow(
      /not found/i
    );
  });
});

describe("matchScope (AC §C.3)", () => {
  const active = base;
  const archived: Post = { ...base, archived: true };
  const deleted: Post = { ...base, deleted: true };
  const archivedDeleted: Post = { ...base, archived: true, deleted: true };

  it("timeline = not archived, not deleted", () => {
    expect(matchScope(active, "timeline")).toBe(true);
    expect(matchScope(archived, "timeline")).toBe(false);
    expect(matchScope(deleted, "timeline")).toBe(false);
  });

  it("archived = archived and not deleted", () => {
    expect(matchScope(archived, "archived")).toBe(true);
    expect(matchScope(active, "archived")).toBe(false);
    expect(matchScope(archivedDeleted, "archived")).toBe(false);
  });

  it("trash = deleted regardless of archived", () => {
    expect(matchScope(deleted, "trash")).toBe(true);
    expect(matchScope(archivedDeleted, "trash")).toBe(true);
    expect(matchScope(active, "trash")).toBe(false);
  });
});
