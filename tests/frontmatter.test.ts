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
      date: "2026-06-12T14:30:22",
      tags: ["idea", "project"],
      body: "Post body goes here.",
    });
    expect(out).toBe(
      "---\n" +
        "date: 2026-06-12T14:30:22\n" +
        "tags: [idea, project]\n" +
        "---\n" +
        "\n" +
        "Post body goes here.\n"
    );
  });

  it("does not write an updated field", () => {
    const out = serializePost({
      date: "2026-06-12T14:30:22",
      tags: [],
      body: "x",
    });
    expect(out).not.toContain("updated:");
  });

  it("writes an empty tag array when no tags", () => {
    const out = serializePost({
      date: "2026-06-12T14:30:22",
      tags: [],
      body: "x",
    });
    expect(out).toContain("tags: []\n");
  });
});

describe("parsePost", () => {
  it("round-trips serializePost output", () => {
    const post = {
      date: "2026-06-12T14:30:22",
      tags: ["idea", "project"],
      body: "Body with **GFM**.\n\n- [ ] A task item\n- [x] A done item",
    };
    expect(parsePost(serializePost(post))).toEqual(post);
  });

  it("parses dash-list tags written by other tools", () => {
    const raw =
      "---\ndate: 2026-06-12T14:30:22\ntags:\n  - idea\n  - project\n---\n\nBody\n";
    expect(parsePost(raw).tags).toEqual(["idea", "project"]);
  });

  it("ignores a legacy updated field without error", () => {
    const raw =
      "---\ndate: 2026-06-12T14:30:22\nupdated: 2026-06-12T14:30:22\ntags: [idea]\n---\n\nBody\n";
    const parsed = parsePost(raw);
    expect(parsed.date).toBe("2026-06-12T14:30:22");
    expect(parsed.tags).toEqual(["idea"]);
    expect(parsed).not.toHaveProperty("updated");
  });

  it("parses quoted scalar values", () => {
    const raw =
      '---\ndate: "2026-06-12T14:30:22"\ntags: []\n---\n\nBody\n';
    expect(parsePost(raw).date).toBe("2026-06-12T14:30:22");
  });

  it("treats a file without frontmatter as all-body", () => {
    const parsed = parsePost("Just plain text.\n");
    expect(parsed.body).toBe("Just plain text.");
    expect(parsed.tags).toEqual([]);
    expect(parsed.date).toBe("");
  });
});
