import { describe, expect, it } from "vitest";
import { parsePost, serializePost, toLocalIso } from "../src/frontmatter";

describe("toLocalIso", () => {
  it("formats a date as local ISO without timezone suffix", () => {
    const d = new Date(2026, 5, 12, 14, 30, 22);
    expect(toLocalIso(d)).toBe("2026-06-12T14:30:22");
  });

  it("zero-pads single-digit fields", () => {
    const d = new Date(2026, 0, 5, 4, 3, 2);
    expect(toLocalIso(d)).toBe("2026-01-05T04:03:02");
  });
});

describe("serializePost", () => {
  it("writes SPEC §3 frontmatter with inline tag array and body", () => {
    const out = serializePost({
      created: "2026-06-12T14:30:22",
      tags: ["idea", "project"],
      body: "Post body goes here.",
    });
    expect(out).toBe(
      "---\n" +
        "created: 2026-06-12T14:30:22\n" +
        "tags: [idea, project]\n" +
        "---\n" +
        "\n" +
        "Post body goes here.\n"
    );
  });

  it("does not write an updated field", () => {
    const out = serializePost({
      created: "2026-06-12T14:30:22",
      tags: [],
      body: "x",
    });
    expect(out).not.toContain("updated:");
  });

  it("writes an empty tag array when no tags", () => {
    const out = serializePost({
      created: "2026-06-12T14:30:22",
      tags: [],
      body: "x",
    });
    expect(out).toContain("tags: []\n");
  });
});

describe("parsePost", () => {
  it("round-trips serializePost output", () => {
    const post = {
      created: "2026-06-12T14:30:22",
      tags: ["idea", "project"],
      body: "Body with **GFM**.\n\n- [ ] A task item\n- [x] A done item",
    };
    expect(parsePost(serializePost(post))).toEqual(post);
  });

  it("parses dash-list tags written by other tools", () => {
    const raw =
      "---\ncreated: 2026-06-12T14:30:22\ntags:\n  - idea\n  - project\n---\n\nBody\n";
    expect(parsePost(raw).tags).toEqual(["idea", "project"]);
  });

  it("ignores a legacy updated field without error", () => {
    const raw =
      "---\ncreated: 2026-06-12T14:30:22\nupdated: 2026-06-12T14:30:22\ntags: [idea]\n---\n\nBody\n";
    const parsed = parsePost(raw);
    expect(parsed.created).toBe("2026-06-12T14:30:22");
    expect(parsed.tags).toEqual(["idea"]);
    expect(parsed).not.toHaveProperty("updated");
  });

  it("parses quoted scalar values", () => {
    const raw =
      '---\ncreated: "2026-06-12T14:30:22"\ntags: []\n---\n\nBody\n';
    expect(parsePost(raw).created).toBe("2026-06-12T14:30:22");
  });

  it("treats a file without frontmatter as all-body", () => {
    const parsed = parsePost("Just plain text.\n");
    expect(parsed.body).toBe("Just plain text.");
    expect(parsed.tags).toEqual([]);
    expect(parsed.created).toBe("");
  });

  describe("created fallback chain", () => {
    it("reads a legacy date: key into created", () => {
      const raw = "---\ndate: 2026-06-12T14:30:22\ntags: []\n---\n\nBody\n";
      expect(parsePost(raw).created).toBe("2026-06-12T14:30:22");
    });

    it("prefers created over a legacy date when both are present", () => {
      const raw =
        "---\ndate: 2020-01-01T00:00:00\ncreated: 2026-06-12T14:30:22\ntags: []\n---\n\nBody\n";
      expect(parsePost(raw).created).toBe("2026-06-12T14:30:22");
    });

    it("falls back to the first date-valued property when neither created nor date exist", () => {
      const raw =
        "---\ntitle: My note\npublished: 2025-03-04\ntags: []\n---\n\nBody\n";
      expect(parsePost(raw).created).toBe("2025-03-04");
    });

    it("ignores non-date property values when looking for a fallback", () => {
      const raw = "---\nslug: not-a-date\ncount: 7\ntags: []\n---\n\nBody\n";
      expect(parsePost(raw).created).toBe("");
    });
  });
});
