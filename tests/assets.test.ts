import { describe, expect, it } from "vitest";
import {
  type AssetVault,
  buildAssetFilename,
  buildMarkdownLink,
  insertAtCursor,
  saveAsset,
} from "../src/fileManager";
import { DEFAULT_SETTINGS } from "../src/types";

const noon = new Date(2026, 5, 12, 14, 30, 22);

describe("buildAssetFilename (AC §B.2)", () => {
  it("prefixes timestamp and sanitizes the original name", () => {
    expect(buildAssetFilename(noon, "My Shot (1).PNG", () => false)).toBe(
      "20260612-143022-my-shot-1.png"
    );
  });

  it("appends -2, -3 on collision, never overwriting (AC §B.4)", () => {
    const taken = new Set([
      "20260612-143022-shot.png",
      "20260612-143022-shot-2.png",
    ]);
    expect(buildAssetFilename(noon, "shot.png", (n) => taken.has(n))).toBe(
      "20260612-143022-shot-3.png"
    );
  });

  it("falls back to 'file' for names that sanitize to nothing", () => {
    expect(buildAssetFilename(noon, "###.png", () => false)).toBe(
      "20260612-143022-file.png"
    );
  });
});

describe("buildMarkdownLink (AC §B.2)", () => {
  it("uses image syntax for images and plain links otherwise", () => {
    expect(buildMarkdownLink("shot.png", "thino/assets/a.png")).toBe(
      "![shot.png](thino/assets/a.png)"
    );
    expect(buildMarkdownLink("doc.pdf", "thino/assets/d.pdf")).toBe(
      "[doc.pdf](thino/assets/d.pdf)"
    );
  });

  it("URL-encodes spaces in the path", () => {
    expect(buildMarkdownLink("a.png", "my assets/a 1.png")).toBe(
      "![a.png](my%20assets/a%201.png)"
    );
  });
});

describe("saveAsset", () => {
  function fakeVault(existing: string[] = []): AssetVault & { created: string[] } {
    const paths = new Set(existing);
    const created: string[] = [];
    return {
      created,
      getAbstractFileByPath: (p) => (paths.has(p) ? { path: p } : null),
      createFolder: async (p) => {
        paths.add(p);
      },
      createBinary: async (p) => {
        if (paths.has(p)) throw new Error("exists");
        paths.add(p);
        created.push(p);
        return { path: p };
      },
    };
  }

  it("creates the assets folder on demand and writes the file (AC §B.1)", async () => {
    const vault = fakeVault();
    const path = await saveAsset(
      vault,
      DEFAULT_SETTINGS,
      "shot.png",
      new ArrayBuffer(4),
      noon
    );
    expect(path).toBe("thino/assets/20260612-143022-shot.png");
    expect(vault.created).toEqual([path]);
  });

  it("suffixes instead of overwriting an existing asset (AC §B.4)", async () => {
    const vault = fakeVault([
      "thino/assets",
      "thino/assets/20260612-143022-shot.png",
    ]);
    const path = await saveAsset(
      vault,
      DEFAULT_SETTINGS,
      "shot.png",
      new ArrayBuffer(4),
      noon
    );
    expect(path).toBe("thino/assets/20260612-143022-shot-2.png");
  });
});

describe("insertAtCursor", () => {
  it("splices text at the cursor and returns the new cursor position", () => {
    const result = insertAtCursor("hello world", 5, " ![x](y)");
    expect(result.value).toBe("hello ![x](y) world");
    expect(result.cursor).toBe(13);
  });
});
