import { describe, expect, it } from "vitest";
import { affectsFolder } from "../src/fileManager";

describe("affectsFolder", () => {
  it("matches direct children of the posts folder", () => {
    expect(affectsFolder("thino", "thino/2026-06-12-a.md")).toBe(true);
  });

  it("ignores other folders and nested subfolders", () => {
    expect(affectsFolder("thino", "daily/2026-06-12.md")).toBe(false);
    expect(affectsFolder("thino", "thino/sub/x.md")).toBe(false);
    expect(affectsFolder("thino", "thino-archive/x.md")).toBe(false);
  });

  it("matches renames into or out of the folder via oldPath", () => {
    expect(affectsFolder("thino", "elsewhere/x.md", "thino/x.md")).toBe(true);
    expect(affectsFolder("thino", "thino/x.md", "elsewhere/x.md")).toBe(true);
    expect(affectsFolder("thino", "a/x.md", "b/x.md")).toBe(false);
  });

  it("only reacts to .md files", () => {
    expect(affectsFolder("thino", "thino/image.png")).toBe(false);
  });
});
