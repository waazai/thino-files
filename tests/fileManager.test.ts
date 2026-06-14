import { describe, expect, it } from "vitest";
import {
  buildFilename,
  formatDate,
  overflowState,
  sanitizeSlug,
} from "../src/fileManager";

const d = new Date(2026, 5, 12, 14, 30, 22);

describe("sanitizeSlug", () => {
  it("keeps case and spaces verbatim", () => {
    expect(sanitizeSlug("My First Thought")).toBe("My First Thought");
  });

  it("strips only the illegal filename characters, keeping the rest", () => {
    // Legal chars (#, ^, [, ], internal punctuation) survive; only
    // \ / : * ? " < > | and control chars are removed.
    expect(sanitizeSlug('a/b\\c:d*e?f"g<h>i|j#k^l[m]n')).toBe("abcdefghij#k^l[m]n");
  });

  it("preserves unicode and internal spacing", () => {
    expect(sanitizeSlug("café — naïve")).toBe("café — naïve");
  });

  it("trims only leading/trailing whitespace", () => {
    expect(sanitizeSlug("  hello  world  ")).toBe("hello  world");
  });

  it("returns empty string for blank or all-illegal input", () => {
    expect(sanitizeSlug("   ")).toBe("");
    expect(sanitizeSlug("???")).toBe("");
  });
});

describe("overflowState (§M.8a)", () => {
  it("reports overflow when content exceeds the clamp", () => {
    expect(overflowState(200, 128)).toBe(true);
  });

  it("reports no overflow when content fits the clamp", () => {
    expect(overflowState(50, 128)).toBe(false);
    expect(overflowState(128, 128)).toBe(false);
  });

  it("is unmeasurable (null) when the element is not laid out", () => {
    // Detached / display:none leaf: clientHeight reads 0 — must NOT be treated
    // as "fits" (which would clear the clamp and expand the card).
    expect(overflowState(0, 0)).toBeNull();
    expect(overflowState(200, 0)).toBeNull();
  });
});

describe("formatDate", () => {
  it("supports YYYY-MM-DD", () => {
    expect(formatDate(d, "YYYY-MM-DD")).toBe("2026-06-12");
  });

  it("supports HHmmss", () => {
    expect(formatDate(d, "HHmmss")).toBe("143022");
  });

  it("supports display format YYYY-MM-DD HH:mm", () => {
    expect(formatDate(d, "YYYY-MM-DD HH:mm")).toBe("2026-06-12 14:30");
  });
});

describe("buildFilename", () => {
  const never = () => false;

  it("joins date prefix and verbatim slug", () => {
    expect(buildFilename(d, "My First Thought", never)).toBe(
      "2026-06-12-My First Thought.md"
    );
  });

  it("falls back to HHmmss when slug is blank", () => {
    expect(buildFilename(d, "", never)).toBe("2026-06-12-143022.md");
    expect(buildFilename(d, "  ??  ", never)).toBe("2026-06-12-143022.md");
  });

  it("appends -2, -3 on collision", () => {
    const taken = new Set(["2026-06-12-note.md", "2026-06-12-note-2.md"]);
    expect(buildFilename(d, "note", (n) => taken.has(n))).toBe(
      "2026-06-12-note-3.md"
    );
  });

  it("respects a custom date format", () => {
    expect(buildFilename(d, "note", never, "YYYYMMDD")).toBe(
      "20260612-note.md"
    );
  });
});
