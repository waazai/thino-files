import { describe, expect, it } from "vitest";
import { deletePost, type TrashableVault } from "../src/fileManager";

describe("deletePost", () => {
  it("moves the file to trash (never vault.delete) — AC §2.4", async () => {
    const trashed: string[] = [];
    const vault: TrashableVault & { delete?: () => void } = {
      getAbstractFileByPath: (p) => ({ path: p }),
      trash: async (file, system) => {
        trashed.push((file as { path: string }).path);
        expect(system).toBe(true);
      },
    };
    await deletePost(vault, "thino/2026-06-12-a.md");
    expect(trashed).toEqual(["thino/2026-06-12-a.md"]);
  });

  it("is a no-op when the file is already gone", async () => {
    const vault: TrashableVault = {
      getAbstractFileByPath: () => null,
      trash: async () => {
        throw new Error("should not be called");
      },
    };
    await expect(deletePost(vault, "thino/x.md")).resolves.toBeUndefined();
  });
});
