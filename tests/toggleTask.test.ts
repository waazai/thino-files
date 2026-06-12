import { describe, expect, it } from "vitest";
import { toggleTaskInBody } from "../src/fileManager";

const body = [
  "Intro line",
  "- [ ] first task",
  "- regular bullet",
  "- [x] done task",
  "  - [ ] nested task",
  "tail",
].join("\n");

describe("toggleTaskInBody", () => {
  it("checks the nth unchecked task", () => {
    const out = toggleTaskInBody(body, 0);
    expect(out).toContain("- [x] first task");
    expect(out).toContain("- [x] done task");
  });

  it("unchecks a checked task", () => {
    const out = toggleTaskInBody(body, 1);
    expect(out).toContain("- [ ] done task");
    expect(out).toContain("- [ ] first task");
  });

  it("toggles nested tasks by render order", () => {
    const out = toggleTaskInBody(body, 2);
    expect(out).toContain("  - [x] nested task");
  });

  it("leaves non-task lines untouched", () => {
    const out = toggleTaskInBody(body, 0)!;
    expect(out).toContain("Intro line");
    expect(out).toContain("- regular bullet");
    expect(out).toContain("tail");
  });

  it("returns null for an out-of-range index", () => {
    expect(toggleTaskInBody(body, 99)).toBeNull();
  });

  it("supports * and + list markers and uppercase X", () => {
    const alt = "* [X] a\n+ [ ] b";
    expect(toggleTaskInBody(alt, 0)).toBe("* [ ] a\n+ [ ] b");
    expect(toggleTaskInBody(alt, 1)).toBe("* [X] a\n+ [x] b");
  });
});
