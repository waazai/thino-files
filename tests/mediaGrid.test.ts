import { describe, expect, it } from "vitest";
import { extractImageEmbeds } from "../src/media-grid";
import { matchScope } from "../src/filter";
import type { Post } from "../src/types";

describe("extractImageEmbeds", () => {
  it("extracts a Markdown image embed target", () => {
    expect(extractImageEmbeds("![cat](thino/assets/cat.png)")).toEqual([
      "thino/assets/cat.png",
    ]);
  });

  it("extracts a wiki image embed target", () => {
    expect(extractImageEmbeds("text ![[photo.jpg]] more")).toEqual(["photo.jpg"]);
  });

  it("keeps multiple embeds in body order across both syntaxes", () => {
    const body = "![[a.png]] some words ![b](sub/b.jpeg) tail ![[c.gif]]";
    expect(extractImageEmbeds(body)).toEqual(["a.png", "sub/b.jpeg", "c.gif"]);
  });

  it("ignores non-image links, plain text, and note wiki-links", () => {
    const body =
      "see [doc](notes/readme.md) and [link](https://x.com) and ![pdf](file.pdf) and [[Some Note]]";
    expect(extractImageEmbeds(body)).toEqual([]);
  });

  it("handles paths with spaces and subfolders", () => {
    expect(extractImageEmbeds("![x](thino/My%20Pics/a%20b.png)")).toEqual([
      "thino/My%20Pics/a%20b.png",
    ]);
    expect(extractImageEmbeds("![[My Folder/a b.png]]")).toEqual([
      "My Folder/a b.png",
    ]);
  });

  it("strips wiki alias and anchor from the target", () => {
    expect(extractImageEmbeds("![[photo.png|thumb]]")).toEqual(["photo.png"]);
    expect(extractImageEmbeds("![[photo.png#frag]]")).toEqual(["photo.png"]);
  });

  it("is case-insensitive on the extension", () => {
    expect(extractImageEmbeds("![u](Pic.JPG)")).toEqual(["Pic.JPG"]);
  });
});

describe('matchScope("media")', () => {
  const post = (over: Partial<Post> = {}): Post => ({
    path: "thino/a.md",
    date: "2026-06-12T10:00:00",
    tags: [],
    body: "",
    ...over,
  });

  it("qualifies the same posts as the timeline scope", () => {
    const active = post();
    const archived = post({ archived: true });
    const deleted = post({ deleted: true });
    for (const p of [active, archived, deleted]) {
      expect(matchScope(p, "media")).toBe(matchScope(p, "timeline"));
    }
    expect(matchScope(active, "media")).toBe(true);
    expect(matchScope(archived, "media")).toBe(false);
    expect(matchScope(deleted, "media")).toBe(false);
  });
});
