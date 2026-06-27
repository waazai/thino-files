import { type App, type Component, MarkdownRenderer, setIcon } from "obsidian";
import {
  formatDate,
  overflowState,
  type PostFlags,
  postSlug,
  toggleTaskInBody,
} from "./fileManager";
import type { PostScope } from "./filter";
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
}

/** One timeline card: date chip, tag pills, GFM-rendered body, action icons. */
export class PostCard {
  readonly el: HTMLElement;
  private bodyEl: HTMLElement;
  protected actionsEl: HTMLElement;
  /** Show more/less control — present only while the body overflows (§M.3). */
  private toggleEl: HTMLElement | null = null;
  /** Per-card expand state; ephemeral — a fresh card collapses again (§M.8). */
  private expanded = false;
  /** Pending re-measure while the card body is not yet laid out (§M.8a). */
  private layoutObserver: ResizeObserver | null = null;

  constructor(
    parent: HTMLElement,
    protected post: Post,
    protected ctx: PostCardContext
  ) {
    this.el = parent.createDiv({ cls: "thino-files-card" });

    const header = this.el.createDiv({ cls: "thino-files-card-header" });
    // Title = the filename slug, verbatim; omitted when there's no real slug (§M.9).
    const title = postSlug(post.path, post.created, ctx.settings.filenameDateFormat);
    if (title) {
      header.createSpan({ cls: "thino-files-card-title", text: title });
    }
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
    const d = new Date(this.post.created);
    if (!this.post.created || isNaN(d.getTime())) return this.post.created;
    return formatDate(d, this.ctx.settings.dateDisplayFormat);
  }

  /**
   * Re-evaluate the overflow clamp against the current layout (A2). The pane's
   * system font scale can change live (notably on Android), which reflows the
   * body: a card that fit at 100% can overflow at 200%, and without a re-measure
   * it would render truncated by the fade with no Show more toggle. Driven by the
   * view's `onResize`.
   */
  remeasure(): void {
    if (!this.bodyEl.isConnected) return;
    this.applyCollapse();
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
    this.applyCollapse();
  }

  /**
   * Clamp the body to a fixed height and, only when it overflows, render a
   * Show more/Show less toggle (AC §M.3–M.4). Runs after every body render so
   * the task-toggle and edit-exit re-renders stay consistent (§M.6); the expand
   * state persists across those re-renders within the same card.
   *
   * The body must stay clamped when its overflow can't be measured — a detached
   * or hidden leaf reports `clientHeight === 0` (the "jump to source file →
   * back" case). Clearing the clamp there would render the card fully expanded
   * with no toggle, so instead we keep it collapsed and re-measure once the
   * element gains a real size (§M.8a).
   */
  private applyCollapse(): void {
    this.toggleEl?.remove();
    this.toggleEl = null;
    this.disconnectLayoutObserver();

    // Measure against the clamp regardless of state, so we can decide whether a
    // toggle is needed even while expanded (clamp-off can't reveal overflow).
    this.bodyEl.addClass("is-collapsed");
    const state = overflowState(this.bodyEl.scrollHeight, this.bodyEl.clientHeight);

    if (state === null) {
      // Not laid out yet — keep clamped and re-run once the body has a size.
      this.observeForLayout();
      return;
    }
    if (!state) {
      this.bodyEl.removeClass("is-collapsed");
      return;
    }

    this.bodyEl.toggleClass("is-collapsed", !this.expanded);
    this.toggleEl = this.el.createEl("button", {
      cls: "thino-files-card-toggle",
      text: this.expanded ? "Show less" : "Show more",
    });
    this.toggleEl.addEventListener("click", () => {
      this.expanded = !this.expanded;
      this.bodyEl.toggleClass("is-collapsed", !this.expanded);
      if (this.toggleEl) {
        this.toggleEl.textContent = this.expanded ? "Show less" : "Show more";
      }
    });
  }

  /**
   * Re-run {@link applyCollapse} once the body becomes measurable (gains a
   * non-zero height after the leaf is revealed/resized). No-op where
   * ResizeObserver is unavailable (e.g. jsdom) — the body simply stays clamped.
   */
  private observeForLayout(): void {
    if (this.layoutObserver || typeof ResizeObserver === "undefined") return;
    this.layoutObserver = new ResizeObserver(() => {
      if (this.bodyEl.clientHeight > 0) {
        this.disconnectLayoutObserver();
        this.applyCollapse();
      }
    });
    this.layoutObserver.observe(this.bodyEl);
  }

  private disconnectLayoutObserver(): void {
    this.layoutObserver?.disconnect();
    this.layoutObserver = null;
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
    // Edit opens the post's source file in the native editor — the inline
    // editor was dropped (cramped, and its unsaved state was lost to the mobile
    // back button). One pencil action, no separate file-symlink "open" icon.
    const openSource = (): void => void this.ctx.openPost(this.post);
    if (scope === "timeline") {
      this.addAction("pencil", "Open source file to edit", openSource);
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
      this.addAction("pencil", "Open source file to edit", openSource);
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
}
