import { type App, type Component, MarkdownRenderer, setIcon } from "obsidian";
import { formatDate } from "./fileManager";
import type { Post, ThinoFilesSettings } from "./types";

export interface PostCardContext {
  app: App;
  settings: ThinoFilesSettings;
  /** Owner component for MarkdownRenderer lifecycle (the timeline view). */
  component: Component;
  /** Open the post's source file in an editor pane (AC §2.5). */
  openPost: (post: Post) => Promise<void>;
  /** Persist an edited body; returns the updated post (AC §2.3). */
  savePost: (post: Post, newBody: string) => Promise<Post>;
}

/** One timeline card: date chip, tag pills, GFM-rendered body, action icons. */
export class PostCard {
  readonly el: HTMLElement;
  private bodyEl: HTMLElement;
  protected actionsEl: HTMLElement;

  constructor(
    parent: HTMLElement,
    protected post: Post,
    protected ctx: PostCardContext
  ) {
    this.el = parent.createDiv({ cls: "thino-files-card" });

    const header = this.el.createDiv({ cls: "thino-files-card-header" });
    header.createSpan({
      cls: "thino-files-card-date",
      text: this.displayDate(),
    });
    const tagsEl = header.createSpan({ cls: "thino-files-card-tags" });
    for (const tag of post.tags) {
      tagsEl.createSpan({ cls: "thino-files-tag-pill", text: tag });
    }
    this.actionsEl = header.createSpan({ cls: "thino-files-card-actions" });
    this.addAction("pencil", "Edit", () => this.enterEditMode());
    this.addAction("file-symlink", "Open source file", () =>
      void this.ctx.openPost(this.post)
    );

    this.bodyEl = this.el.createDiv({ cls: "thino-files-card-body" });
    void this.renderBody();
  }

  protected addAction(
    icon: string,
    label: string,
    onClick: () => void
  ): HTMLElement {
    const btn = this.actionsEl.createEl("button", {
      cls: "thino-files-card-action clickable-icon",
      attr: { "aria-label": label, title: label },
    });
    setIcon(btn, icon);
    btn.addEventListener("click", onClick);
    return btn;
  }

  private displayDate(): string {
    const d = new Date(this.post.date);
    if (!this.post.date || isNaN(d.getTime())) return this.post.date;
    return formatDate(d, this.ctx.settings.dateDisplayFormat);
  }

  protected async renderBody(): Promise<void> {
    this.bodyEl.empty();
    await MarkdownRenderer.render(
      this.ctx.app,
      this.post.body,
      this.bodyEl,
      this.post.path,
      this.ctx.component
    );
  }

  /** Swap the rendered body for a textarea; save on Cmd/Ctrl+Enter, cancel on Esc. */
  private enterEditMode(): void {
    if (this.el.querySelector(".thino-files-card-editor")) return;
    this.bodyEl.empty();

    const editor = this.bodyEl.createEl("textarea", {
      cls: "thino-files-card-editor",
      attr: { rows: String(Math.max(4, this.post.body.split("\n").length + 1)) },
    });
    editor.value = this.post.body;
    const buttons = this.bodyEl.createDiv({ cls: "thino-files-card-editor-buttons" });
    const saveBtn = buttons.createEl("button", { text: "Save", cls: "mod-cta" });
    const cancelBtn = buttons.createEl("button", { text: "Cancel" });

    const save = async (): Promise<void> => {
      this.post = await this.ctx.savePost(this.post, editor.value.trim());
      await this.renderBody();
    };
    saveBtn.addEventListener("click", () => void save());
    cancelBtn.addEventListener("click", () => void this.renderBody());
    editor.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        void this.renderBody();
      }
    });
    editor.focus();
  }
}
