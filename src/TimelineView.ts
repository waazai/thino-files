import { ItemView, type Vault, WorkspaceLeaf } from "obsidian";
import { Composer } from "./Composer";
import { createPost, listPosts } from "./fileManager";
import type ThinoFilesPlugin from "./main";
import { PostCard } from "./PostCard";
import type { Post } from "./types";

export const VIEW_TYPE_THINO_FILES = "thino-files-timeline";

export class TimelineView extends ItemView {
  private listEl!: HTMLElement;
  private posts: Post[] = [];

  constructor(leaf: WorkspaceLeaf, private plugin: ThinoFilesPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_THINO_FILES;
  }

  getDisplayText(): string {
    return "Thino timeline";
  }

  getIcon(): string {
    return "messages-square";
  }

  private get vault(): Vault {
    return this.app.vault;
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("thino-files-view");

    new Composer(container, async (input) => {
      await createPost(this.vault, this.plugin.settings, input);
      // Refresh immediately so the new post appears at the top without
      // waiting for the file watcher (AC §2.1).
      await this.refresh();
    });

    this.listEl = container.createDiv({ cls: "thino-files-list" });
    await this.refresh();
  }

  /** Reload posts from disk and re-render the whole list. */
  async refresh(): Promise<void> {
    this.posts = await listPosts(this.vault, this.plugin.settings);
    this.renderList();
  }

  private renderList(): void {
    this.listEl.empty();
    if (this.posts.length === 0) {
      this.listEl.createDiv({
        cls: "thino-files-empty",
        text: "No posts yet — write one above.",
      });
      return;
    }
    for (const post of this.posts) {
      this.createCard(post);
    }
  }

  private createCard(post: Post): PostCard {
    return new PostCard(this.listEl, post, {
      app: this.app,
      settings: this.plugin.settings,
      component: this,
    });
  }
}
