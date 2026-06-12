import { type App, type Component, MarkdownRenderer, setIcon } from "obsidian";
import { formatDate, type PostFlags, toggleTaskInBody } from "./fileManager";
import type { PostScope } from "./filter";
import { type AttachFn, bindAttachments } from "./media";
import type { Post, ThinoFilesSettings } from "./types";

export interface PostCardContext {
  app: App;
  settings: ThinoFilesSettings;
  /** Owner component for MarkdownRenderer lifecycle (the timeline view). */
  component: Component;
  /** Scope the card is rendered in — decides which actions show (AC §C.2–C.4). */
  scope: PostScope;
  /** Open the post's source file in an editor pane (AC §2.5). */
  openPost: (post: Post) => Promise<void>;
  /** Persist an edited body; returns the updated post (AC §2.3). */
  savePost: (post: Post, newBody: string) => Promise<Post>;
  /** Archive/unarchive/soft-delete/restore via frontmatter flags (AC §C.2). */
  setFlags: (post: Post, flags: PostFlags) => Promise<Post>;
  /** Permanently trash the file — recycle bin only (AC §C.4). */
  deleteForever: (post: Post) => Promise<void>;
  /** Save a pasted/dropped file, returning its Markdown link (AC §B.2). */
  attach?: AttachFn;
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
    this.addScopeActions();

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
    this.bindTaskCheckboxes();
  }

  /** Make rendered `- [ ]` checkboxes toggle the underlying file line. */
  private bindTaskCheckboxes(): void {
    const boxes = this.bodyEl.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    );
    boxes.forEach((box, index) => {
      box.removeAttribute("disabled");
      box.addEventListener("change", () => {
        void (async () => {
          const newBody = toggleTaskInBody(this.post.body, index);
          if (newBody === null) return;
          this.post = await this.ctx.savePost(this.post, newBody);
          await this.renderBody();
        })();
      });
    });
  }

  /** Action set per scope: timeline edits/archives, trash restores/destroys. */
  private addScopeActions(): void {
    const { scope } = this.ctx;
    if (scope === "timeline") {
      this.addAction("pencil", "Edit", () => this.enterEditMode());
      this.addAction("file-symlink", "Open source file", () =>
        void this.ctx.openPost(this.post)
      );
      this.addAction("archive", "Archive", () =>
        void this.ctx.setFlags(this.post, { archived: true })
      );
      this.addAction("trash-2", "Delete", () =>
        this.confirm("Move this note to the recycle bin?", "Delete", () =>
          void this.ctx.setFlags(this.post, { deleted: true })
        )
      );
    } else if (scope === "archived") {
      this.addAction("archive-restore", "Unarchive", () =>
        void this.ctx.setFlags(this.post, { archived: false })
      );
      this.addAction("file-symlink", "Open source file", () =>
        void this.ctx.openPost(this.post)
      );
      this.addAction("trash-2", "Delete", () =>
        this.confirm("Move this note to the recycle bin?", "Delete", () =>
          void this.ctx.setFlags(this.post, { deleted: true })
        )
      );
    } else {
      this.addAction("undo-2", "Restore", () =>
        void this.ctx.setFlags(this.post, { deleted: false })
      );
      this.addAction("trash-2", "Delete forever", () =>
        this.confirm(
          "Permanently delete this note? It moves to the system trash.",
          "Delete forever",
          () => void this.ctx.deleteForever(this.post).then(() => this.el.remove())
        )
      );
    }
  }

  /** Inline confirmation popover guarding destructive actions (AC §C.2, C.4). */
  private confirm(message: string, confirmLabel: string, action: () => void): void {
    if (this.el.querySelector(".thino-files-card-confirm")) return;
    const popover = this.el.createDiv({ cls: "thino-files-card-confirm" });
    popover.createSpan({ text: message });
    const yes = popover.createEl("button", { text: confirmLabel, cls: "mod-warning" });
    const no = popover.createEl("button", { text: "Cancel" });
    yes.addEventListener("click", () => {
      popover.remove();
      action();
    });
    no.addEventListener("click", () => popover.remove());
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
    if (this.ctx.attach) bindAttachments(editor, this.ctx.attach);
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
