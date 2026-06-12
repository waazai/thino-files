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
});
