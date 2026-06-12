// Pure aggregation for the sidebar (SPEC §2.A) — no `obsidian` imports so the
// unit suite runs without the app. Post dates are timezone-less local ISO
// strings, so day keys are plain `slice(0, 10)`.

import { toLocalIso } from "./frontmatter";
import type { Post } from "./types";

export interface StatusCounters {
  posts: number;
  tags: number;
  days: number;
}

const dayKey = (d: Date): string => toLocalIso(d).slice(0, 10);

/** Posts created per local day, keyed YYYY-MM-DD. Dateless posts skipped. */
export function postsPerDay(posts: Post[]): Map<string, number> {
  const perDay = new Map<string, number>();
  for (const post of posts) {
    const day = post.date.slice(0, 10);
    if (day.length !== 10) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  return perDay;
}

/** Total posts, distinct tags, distinct active days (AC §A.2). */
export function computeStatus(posts: Post[]): StatusCounters {
  const tags = new Set<string>();
  for (const post of posts) for (const tag of post.tags) tags.add(tag);
  return { posts: posts.length, tags: tags.size, days: postsPerDay(posts).size };
}

/** Intensity buckets: 0 / 1–2 / 3–4 / 5+ (AC §A.3). */
export function bucketFor(count: number): 0 | 1 | 2 | 3 {
  if (count >= 5) return 3;
  if (count >= 3) return 2;
  if (count >= 1) return 1;
  return 0;
}

export interface HeatmapCell {
  day: string;
  count: number;
  bucket: 0 | 1 | 2 | 3;
}

/** weeks×7 daily cells ending today, oldest first (AC §A.3). */
export function heatmapCells(
  perDay: Map<string, number>,
  today: Date,
  weeks = 12
): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  for (let offset = weeks * 7 - 1; offset >= 0; offset--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    const day = dayKey(d);
    const count = perDay.get(day) ?? 0;
    cells.push({ day, count, bucket: bucketFor(count) });
  }
  return cells;
}

export interface CalendarCell {
  day: string;
  dayOfMonth: number;
  /** False for the prev/next-month padding cells. */
  inMonth: boolean;
  count: number;
}

/**
 * Sunday-first week rows covering `month` (0-based) of `year`, padded with
 * neighbor-month days so every row has 7 cells (AC §A.4).
 */
export function calendarGrid(
  year: number,
  month: number,
  perDay: Map<string, number>
): CalendarCell[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks: CalendarCell[][] = [];
  const cursor = new Date(start);
  do {
    const week: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const day = dayKey(cursor);
      week.push({
        day,
        dayOfMonth: cursor.getDate(),
        inMonth: cursor.getMonth() === month && cursor.getFullYear() === year,
        count: perDay.get(day) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === month && cursor.getFullYear() === year);
  return weeks;
}
