export interface PostFrontmatter {
  /** ISO 8601 creation timestamp — set once, never changed. */
  date: string;
  /** Tags live only in frontmatter; body is pure content. */
  tags: string[];
  /** Soft-archive flag (SPEC §2.C); absent = active. */
  archived?: boolean;
  /** Soft-delete flag — post shows only in the recycle bin scope. */
  deleted?: boolean;
}

export interface Post extends PostFrontmatter {
  /** Vault-relative path of the underlying .md file. */
  path: string;
  body: string;
}

export interface ThinoFilesSettings {
  /**
   * The **active** source folder — the one currently shown (SPEC §2.G). Always
   * one of `sourceFolders`. All CRUD/listing/watching operates on this folder,
   * so its single-string shape is unchanged from earlier versions.
   */
  postsFolder: string;
  /** Configured source folders; exactly one (`postsFolder`) is active. */
  sourceFolders: string[];
  /** Media folder (SPEC §2.B) — excluded from post listing. */
  assetsFolder: string;
  filenameDateFormat: string;
  requireSlug: boolean;
  openInNewPane: boolean;
  dateDisplayFormat: string;
  /** Timeline order by post `date`: newest-first (`desc`) or oldest-first (`asc`). */
  sortOrder: SortOrder;
}

/** Timeline ordering by post `date`. */
export type SortOrder = "asc" | "desc";

export const DEFAULT_SETTINGS: ThinoFilesSettings = {
  postsFolder: "thino",
  sourceFolders: ["thino"],
  assetsFolder: "thino/assets",
  filenameDateFormat: "YYYY-MM-DD",
  requireSlug: false,
  openInNewPane: false,
  dateDisplayFormat: "YYYY-MM-DD HH:mm",
  sortOrder: "desc",
};
