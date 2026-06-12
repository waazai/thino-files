// Pure filename/date helpers (unit-tested) — vault-bound CRUD lands in T3+.
// Keep `obsidian` imports type-only so this module loads under vitest.

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Filename-safe slug: spaces → '-', strip illegal characters, collapse
 * repeated hyphens, trim edge hyphens, lowercase.
 */
export function sanitizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Tiny token formatter supporting YYYY, MM, DD, HH, mm, ss. */
export function formatDate(d: Date, format: string): string {
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()));
}

/**
 * `{date}-{slug}.md`; blank slug falls back to HHmmss; collisions get
 * -2, -3, … via the `exists` probe.
 */
export function buildFilename(
  date: Date,
  slug: string,
  exists: (name: string) => boolean,
  dateFormat = "YYYY-MM-DD"
): string {
  const clean = sanitizeSlug(slug);
  const base = `${formatDate(date, dateFormat)}-${clean || formatDate(date, "HHmmss")}`;
  let candidate = `${base}.md`;
  for (let n = 2; exists(candidate); n++) {
    candidate = `${base}-${n}.md`;
  }
  return candidate;
}
