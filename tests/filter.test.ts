import { describe, expect, it } from "vitest";
import { matchPost, parseQuery } from "../src/filter";
import type { Post } from "../src/types";

const post = (over: Partial<Post> = {}): Post => ({
  path: "thino/2026-06-12-a.md",
  date: "2026-06-12T14:30:22",
  updated: "2026-06-12T14:30:22",
  tags: ["idea", "project"],
  body: "Refactor the parser tomorrow",
  ...over,
});

describe("parseQuery", () => {
  it("splits free text, #tags, and from:/to: range", () => {
    expect(parseQuery("parser #idea from:2026-06-01 to:2026-06-30")).toEqual({
      text: ["parser"],
      tags: ["idea"],
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("handles a bare text query", () => {
    expect(parseQuery("  hello world ")).toEqual({
      text: ["hello", "world"],
      tags: [],
      from: null,
      to: null,
    });
  });

  it("returns an empty query for blank input", () => {
    expect(parseQuery("")).toEqual({ text: [], tags: [], from: null, to: null });
  });
});

describe("matchPost", () => {
  it("matches free text against body case-insensitively (AND across terms)", () => {
    expect(matchPost(post(), parseQuery("REFACTOR parser"))).toBe(true);
    expect(matchPost(post(), parseQuery("refactor missing"))).toBe(false);
  });

  it("matches free text against tags too", () => {
    expect(matchPost(post(), parseQuery("project"))).toBe(true);
  });

  it("requires every #tag to be present", () => {
    expect(matchPost(post(), parseQuery("#idea #project"))).toBe(true);
    expect(matchPost(post(), parseQuery("#idea #other"))).toBe(false);
  });

  it("applies the from:/to: date range inclusively on the date part", () => {
    expect(matchPost(post(), parseQuery("from:2026-06-12"))).toBe(true);
    expect(matchPost(post(), parseQuery("from:2026-06-13"))).toBe(false);
    expect(matchPost(post(), parseQuery("to:2026-06-12"))).toBe(true);
    expect(matchPost(post(), parseQuery("to:2026-06-11"))).toBe(false);
    expect(
      matchPost(post(), parseQuery("from:2026-06-01 to:2026-06-30"))
    ).toBe(true);
  });

  it("combines text, tag, and range criteria", () => {
    const q = parseQuery("parser #idea from:2026-06-01");
    expect(matchPost(post(), q)).toBe(true);
    expect(matchPost(post({ tags: [] }), q)).toBe(false);
  });

  it("matches everything on an empty query", () => {
    expect(matchPost(post(), parseQuery(""))).toBe(true);
  });
});
