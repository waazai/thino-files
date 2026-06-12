import { ItemView, WorkspaceLeaf } from "obsidian";
import { Composer } from "./Composer";
import { createPost } from "./fileManager";
import type ThinoFilesPlugin from "./main";

export const VIEW_TYPE_THINO_FILES = "thino-files-timeline";

export class TimelineView extends ItemView {
  private listEl!: HTMLElement;

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

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("thino-files-view");

    new Composer(container, async (input) => {
      await createPost(this.app.vault, this.plugin.settings, input);
      await this.refresh();
    });

    this.listEl = container.createDiv({ cls: "thino-files-list" });
    await this.refresh();
  }

  /** Reload posts from disk and re-render the list (full render lands in T4). */
  async refresh(): Promise<void> {
    // T4 populates this.
  }
}
