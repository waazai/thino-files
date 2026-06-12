export interface PostFrontmatter {
  /** ISO 8601 creation timestamp — set once, never changed. */
  date: string;
  /** ISO 8601 timestamp, bumped on every edit. */
  updated: string;
  /** Tags live only in frontmatter; body is pure content. */
  tags: string[];
}

export interface Post extends PostFrontmatter {
  /** Vault-relative path of the underlying .md file. */
  path: string;
  body: string;
}

export interface ThinoFilesSettings {
  postsFolder: string;
  filenameDateFormat: string;
  requireSlug: boolean;
  openInNewPane: boolean;
  dateDisplayFormat: string;
}

export const DEFAULT_SETTINGS: ThinoFilesSettings = {
  postsFolder: "thino",
  filenameDateFormat: "YYYY-MM-DD",
  requireSlug: false,
  openInNewPane: false,
  dateDisplayFormat: "YYYY-MM-DD HH:mm",
};
