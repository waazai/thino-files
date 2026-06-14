import { describe, expect, it } from "vitest";
import {
  BATCH_SIZE,
  clampReveal,
  growReveal,
  hasMore,
  initialReveal,
} from "../src/pagination";

describe("BATCH_SIZE", () => {
  it("is the fixed batch constant (50)", () => {
    expect(BATCH_SIZE).toBe(50);
  });
});

describe("initialReveal", () => {
  it("reveals the whole list when it is smaller than a batch", () => {
    expect(initialReveal(10)).toBe(10);
  });
  it("reveals exactly a batch when the total equals one", () => {
    expect(initialReveal(BATCH_SIZE)).toBe(BATCH_SIZE);
  });
  it("caps at a batch when there are more posts", () => {
    expect(initialReveal(422)).toBe(BATCH_SIZE);
  });
  it("reveals nothing for an empty list", () => {
    expect(initialReveal(0)).toBe(0);
  });
});

describe("growReveal", () => {
  it("grows by one batch", () => {
    expect(growReveal(50, 422)).toBe(100);
  });
  it("saturates at the total and never exceeds it", () => {
    expect(growReveal(400, 422)).toBe(422);
    expect(growReveal(422, 422)).toBe(422);
  });
});

describe("clampReveal", () => {
  it("keeps at least one batch (preserve path floor)", () => {
    expect(clampReveal(10, 422)).toBe(BATCH_SIZE);
  });
  it("preserves a larger revealed count", () => {
    expect(clampReveal(150, 422)).toBe(150);
  });
  it("never exceeds the total", () => {
    expect(clampReveal(150, 80)).toBe(80);
  });
  it("returns the total when it is smaller than a batch", () => {
    expect(clampReveal(50, 10)).toBe(10);
    expect(clampReveal(0, 10)).toBe(10);
  });
});

describe("hasMore", () => {
  it("is true while posts remain hidden", () => {
    expect(hasMore(50, 422)).toBe(true);
    expect(hasMore(0, 10)).toBe(true);
  });
  it("is false once everything is revealed", () => {
    expect(hasMore(422, 422)).toBe(false);
    expect(hasMore(0, 0)).toBe(false);
  });
});
