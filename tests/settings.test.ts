import { describe, expect, it } from "vitest";
import { mergeSettings } from "../src/settings";
import { DEFAULT_SETTINGS } from "../src/types";

describe("mergeSettings", () => {
  it("returns defaults for null/undefined stored data", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("overlays stored values onto defaults", () => {
    const merged = mergeSettings({ postsFolder: "notes/quick", requireSlug: true });
    expect(merged.postsFolder).toBe("notes/quick");
    expect(merged.requireSlug).toBe(true);
    expect(merged.filenameDateFormat).toBe(DEFAULT_SETTINGS.filenameDateFormat);
    expect(merged.openInNewPane).toBe(false);
  });

  it("ignores wrongly-typed stored values", () => {
    const merged = mergeSettings({
      postsFolder: 42,
      requireSlug: "yes",
      dateDisplayFormat: null,
    });
    expect(merged).toEqual(DEFAULT_SETTINGS);
  });

  it("ignores unknown keys", () => {
    const merged = mergeSettings({ bogus: true });
    expect(merged).toEqual(DEFAULT_SETTINGS);
    expect("bogus" in merged).toBe(false);
  });

  // SPEC §2.G — multiple source folders, one active.
  it("seeds sourceFolders from a legacy postsFolder-only config (AC G.4)", () => {
    const merged = mergeSettings({ postsFolder: "journal" });
    expect(merged.sourceFolders).toEqual(["journal"]);
    expect(merged.postsFolder).toBe("journal");
  });

  it("keeps a valid sourceFolders array and active folder", () => {
    const merged = mergeSettings({
      sourceFolders: ["thino", "work-log"],
      postsFolder: "work-log",
    });
    expect(merged.sourceFolders).toEqual(["thino", "work-log"]);
    expect(merged.postsFolder).toBe("work-log");
  });

  it("reconciles an active folder that is not in the list to the first entry", () => {
    const merged = mergeSettings({
      sourceFolders: ["a", "b"],
      postsFolder: "missing",
    });
    expect(merged.postsFolder).toBe("a");
  });

  it("rejects a non-array sourceFolders and falls back to the active folder", () => {
    const merged = mergeSettings({ sourceFolders: { 0: "x" }, postsFolder: "x" });
    expect(merged.sourceFolders).toEqual(["x"]);
  });

  it("rejects arrays with non-string or empty entries", () => {
    expect(mergeSettings({ sourceFolders: ["ok", 3], postsFolder: "ok" }).sourceFolders).toEqual(["ok"]);
    expect(mergeSettings({ sourceFolders: ["ok", "  "], postsFolder: "ok" }).sourceFolders).toEqual(["ok"]);
  });

  it("trims source folder entries", () => {
    const merged = mergeSettings({ sourceFolders: [" a ", "b"], postsFolder: "a" });
    expect(merged.sourceFolders).toEqual(["a", "b"]);
  });

  it("defaults to [postsFolder] when the list is empty", () => {
    const merged = mergeSettings({ sourceFolders: [], postsFolder: "thino" });
    expect(merged.sourceFolders).toEqual(["thino"]);
  });

  it("keeps a valid sortOrder and clamps an invalid one to the default", () => {
    expect(mergeSettings({ sortOrder: "asc" }).sortOrder).toBe("asc");
    expect(mergeSettings({ sortOrder: "desc" }).sortOrder).toBe("desc");
    expect(mergeSettings({ sortOrder: "sideways" }).sortOrder).toBe("desc");
    expect(mergeSettings({ sortOrder: 3 }).sortOrder).toBe("desc");
  });
});
