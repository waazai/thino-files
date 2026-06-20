/**
 * Pure pagination math for the timeline's incremental render (SPEC §2.O).
 *
 * The timeline reveals posts in fixed batches instead of building a DOM card
 * for every post at once (the ~422-post freeze). These helpers own the count
 * arithmetic so the branchy logic is unit-tested without a DOM; `TimelineView`
 * holds the `revealed` count and drives the IntersectionObserver. No `obsidian`
 * import — keep this module pure.
 */

/** Cards rendered per batch — fixed, no setting (AC O.11). */
export const BATCH_SIZE = 50;

/** Newest cards to show on a fresh render — at most one batch (AC O.1). */
export function initialReveal(total: number): number {
  return Math.min(total, BATCH_SIZE);
}

/** Grow the revealed count by one batch, never past the total (AC O.2/O.3). */
export function growReveal(revealed: number, total: number): number {
  return Math.min(revealed + BATCH_SIZE, total);
}

/**
 * Preserve-path count (AC O.7): keep what was revealed across a data refresh,
 * but never below one batch and never above the (possibly shrunk) total.
 */
export function clampReveal(revealed: number, total: number): number {
  return Math.min(Math.max(revealed, BATCH_SIZE), total);
}

/** Whether posts remain beyond what is revealed — drives the sentinel (AC O.3). */
export function hasMore(revealed: number, total: number): boolean {
  return revealed < total;
}
