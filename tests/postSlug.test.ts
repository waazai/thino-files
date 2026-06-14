import { describe, expect, it } from "vitest";
import { postSlug } from "../src/fileManager";

// Filename shape is `{date}-{slug}.md` (buildFilename); blank slug falls back to
// HHmmss and collisions append -N. postSlug recovers the user's slug verbatim
// for the card title (AC §M.9), and returns "" when there is no real slug.
describe("postSlug", () => {
  const iso = new Date(2026, 5, 14, 9, 5, 0).toISOString();

  it("returns the slug verbatim, unformatted", () => {
    expect(postSlug("thino/2026-06-14-my-note.md", iso)).toBe("my-note");
  });

  it("does not humanize (keeps hyphens, case)", () => {
    expect(postSlug("thino/2026-06-14-My_Cool-Note.md", iso)).toBe("My_Cool-Note");
  });

  it("works without a folder prefix", () => {
    expect(postSlug("2026-06-14-hello.md", iso)).toBe("hello");
  });

  it("returns '' for the HHmmss blank-slug fallback", () => {
    expect(postSlug("thino/2026-06-14-090500.md", iso)).toBe("");
  });

  it("returns '' for the HHmmss fallback even with a collision suffix", () => {
    expect(postSlug("thino/2026-06-14-090500-2.md", iso)).toBe("");
  });

  it("keeps a real slug that ends in a collision-like number verbatim", () => {
    expect(postSlug("thino/2026-06-14-draft-2.md", iso)).toBe("draft-2");
  });

  it("honors a custom date format when stripping the prefix", () => {
    expect(postSlug("thino/20260614-note.md", iso, "YYYYMMDD")).toBe("note");
  });

  it("falls back to the basename when the date prefix doesn't match", () => {
    expect(postSlug("thino/random-name.md", iso)).toBe("random-name");
  });
});
