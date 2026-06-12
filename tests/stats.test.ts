import { describe, expect, it } from "vitest";
import {
  bucketFor,
  calendarGrid,
  computeStatus,
  heatmapCells,
  postsPerDay,
} from "../src/stats";
import type { Post } from "../src/types";

const post = (date: string, tags: string[] = []): Post => ({
  path: `thino/${date}.md`,
  date,
  updated: date,
  tags,
  body: "x",
});

describe("postsPerDay", () => {
  it("counts posts per local day key", () => {
    const perDay = postsPerDay([
      post("2026-06-12T08:00:00"),
      post("2026-06-12T22:00:00"),
      post("2026-06-11T10:00:00"),
    ]);
    expect(perDay.get("2026-06-12")).toBe(2);
    expect(perDay.get("2026-06-11")).toBe(1);
  });

  it("skips posts without a date", () => {
    expect(postsPerDay([post("")]).size).toBe(0);
  });
});

describe("computeStatus (AC §A.2)", () => {
  it("counts posts, distinct tags, distinct days", () => {
    const status = computeStatus([
      post("2026-06-12T08:00:00", ["a", "b"]),
      post("2026-06-12T09:00:00", ["b"]),
      post("2026-06-10T09:00:00", []),
    ]);
    expect(status).toEqual({ posts: 3, tags: 2, days: 2 });
  });
});

describe("heatmap (AC §A.3)", () => {
  it("buckets counts 0 / 1–2 / 3–4 / 5+", () => {
    expect(bucketFor(0)).toBe(0);
    expect(bucketFor(1)).toBe(1);
    expect(bucketFor(2)).toBe(1);
    expect(bucketFor(3)).toBe(2);
    expect(bucketFor(4)).toBe(2);
    expect(bucketFor(5)).toBe(3);
    expect(bucketFor(12)).toBe(3);
  });

  it("returns weeks*7 cells ending today, oldest first", () => {
    const perDay = new Map([["2026-06-12", 3]]);
    const cells = heatmapCells(perDay, new Date(2026, 5, 12), 12);
    expect(cells).toHaveLength(84);
    expect(cells[83].day).toBe("2026-06-12");
    expect(cells[83].count).toBe(3);
    expect(cells[83].bucket).toBe(2);
    expect(cells[0].day).toBe("2026-03-21");
    expect(cells[0].count).toBe(0);
  });
});

describe("calendarGrid (AC §A.4)", () => {
  it("covers the month in Sunday-first weeks with neighbor padding", () => {
    // June 2026: starts Monday, 30 days.
    const weeks = calendarGrid(2026, 5, new Map([["2026-06-12", 2]]));
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const flat = weeks.flat();
    expect(flat[0].day).toBe("2026-05-31"); // Sunday before June 1
    expect(flat[0].inMonth).toBe(false);
    const june12 = flat.find((c) => c.day === "2026-06-12")!;
    expect(june12.inMonth).toBe(true);
    expect(june12.dayOfMonth).toBe(12);
    expect(june12.count).toBe(2);
    expect(flat[flat.length - 1].day >= "2026-06-30").toBe(true);
  });

  it("handles leap February", () => {
    const flat = calendarGrid(2024, 1, new Map()).flat();
    expect(flat.some((c) => c.day === "2024-02-29" && c.inMonth)).toBe(true);
    expect(flat.some((c) => c.day === "2024-03-01")).toBe(true);
  });

  it("handles December → January rollover padding", () => {
    const flat = calendarGrid(2026, 11, new Map()).flat();
    expect(flat.some((c) => c.day === "2027-01-01" && !c.inMonth)).toBe(true);
  });
});
