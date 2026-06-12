export interface PostFrontmatter {
  /** ISO 8601 creation timestamp — set once, never changed. */
  date: string;
  /** ISO 8601 timestamp, bumped on every edit. */
  updated: string;
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

export type ViewMode = "timeline" | "folders";

export interface ThinoFilesSettings {
  postsFolder: string;
  /** Media folder (SPEC §2.B) — excluded from post listing. */
  assetsFolder: string;
  filenameDateFormat: string;
  requireSlug: boolean;
  openInNewPane: boolean;
  dateDisplayFormat: string;
  /** Flat timeline vs folder-grouped list (SPEC §2.D); persisted. */
  viewMode: ViewMode;
}

export const DEFAULT_SETTINGS: ThinoFilesSettings = {
  postsFolder: "thino",
  assetsFolder: "thino/assets",
  filenameDateFormat: "YYYY-MM-DD",
  requireSlug: false,
  openInNewPane: false,
  dateDisplayFormat: "YYYY-MM-DD HH:mm",
  viewMode: "timeline",
};
