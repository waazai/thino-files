import {
  debounce,
  ItemView,
  setIcon,
  type TAbstractFile,
  TFile,
  type Vault,
  WorkspaceLeaf,
} from "obsidian";
import { Composer } from "./Composer";
import {
  affectsFolder,
  createPost,
  deletePost,
  groupByFolder,
  listPosts,
  normalizeFolder,
  setPostFlags,
  updatePost,
} from "./fileManager";
import { FilterBar } from "./FilterBar";
import { matchPost, matchScope, parseQuery, type PostQuery, type PostScope } from "./filter";
import type ThinoFilesPlugin from "./main";
import { PostCard } from "./PostCard";
import { Sidebar } from "./Sidebar";
import type { Post, ViewMode } from "./types";

/** Container width (px) under which the sidebar auto-collapses (AC §A.1). */
const NARROW_WIDTH = 600;

export const VIEW_TYPE_THINO_FILES = "thino-files-timeline";

export class TimelineView extends ItemView {
  private layoutEl!: HTMLElement;
  private listEl!: HTMLElement;
  private viewToggleEl!: HTMLElement;
  private sidebar!: Sidebar;
  private posts: Post[] = [];
  private query: PostQuery = parseQuery("");
  private listScope: PostScope = "timeline";
  /** Calendar day filter (YYYY-MM-DD), ANDed with the filter bar (AC §A.4). */
  private selectedDay: string | null = null;
  private sidebarHidden = false;
  /** Session-only collapsed state of folder-view groups (AC §D.3). */
  private collapsedGroups = new Set<string>();

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

    this.layoutEl = container.createDiv({ cls: "thino-files-layout" });
    this.sidebar = new Sidebar(this.layoutEl, {
      onScopeChange: (scope) => {
        this.listScope = scope;
        this.sidebar.update(this.posts, this.listScope);
        this.renderList();
      },
      onDaySelect: (day) => {
        this.selectedDay = day;
        this.renderList();
      },
    });
    const main = this.layoutEl.createDiv({ cls: "thino-files-main" });

    new Composer(main, async (input) => {
      await createPost(this.vault, this.plugin.settings, input);
      // Refresh immediately so the new post appears at the top without
      // waiting for the file watcher (AC §2.1).
      await this.refresh();
    });

    const toolbar = main.createDiv({ cls: "thino-files-toolbar" });
    const sidebarBtn = toolbar.createEl("button", {
      cls: "thino-files-sidebar-toggle clickable-icon",
      attr: { "aria-label": "Toggle sidebar", title: "Toggle sidebar" },
    });
    setIcon(sidebarBtn, "panel-left");
    sidebarBtn.addEventListener("click", () => {
      this.sidebarHidden = !this.sidebarHidden;
      this.applySidebarVisibility();
    });
    this.viewToggleEl = toolbar.createDiv({ cls: "thino-files-viewtoggle" });
    this.renderViewToggle();

    new FilterBar(main, (query) => {
      this.query = query;
      this.renderList();
    });

    this.listEl = main.createDiv({ cls: "thino-files-list" });
    this.onResize();
    this.watchVault();
    await this.refresh();
  }

  private lastNarrow = false;

  /** Auto-collapse the sidebar when the pane crosses the narrow threshold
   * (AC §A.1) — manual toggles in a stable-width pane are left alone. */
  onResize(): void {
    if (!this.layoutEl || this.contentEl.clientWidth <= 0) return;
    const narrow = this.contentEl.clientWidth < NARROW_WIDTH;
    if (narrow !== this.lastNarrow) {
      this.lastNarrow = narrow;
      this.sidebarHidden = narrow;
      this.applySidebarVisibility();
    }
  }

  private applySidebarVisibility(): void {
    this.layoutEl.toggleClass("sidebar-hidden", this.sidebarHidden);
  }

  /** Reload (debounced) when files in the posts folder change on disk. */
  private watchVault(): void {
    const scheduleRefresh = debounce(() => void this.refresh(), 300, true);
    const onChange = (file: TAbstractFile, oldPath?: string): void => {
      const folder = normalizeFolder(this.plugin.settings.postsFolder);
      if (affectsFolder(folder, file.path, oldPath)) scheduleRefresh();
    };
    this.registerEvent(this.vault.on("create", onChange));
    this.registerEvent(this.vault.on("modify", onChange));
    this.registerEvent(this.vault.on("delete", onChange));
    this.registerEvent(this.vault.on("rename", onChange));
  }

  /** Reload posts from disk and re-render list + sidebar (AC §A.5). */
  async refresh(): Promise<void> {
    this.posts = await listPosts(this.vault, this.plugin.settings);
    this.sidebar.update(this.posts, this.listScope);
    this.renderList();
  }

  /** Timeline ⇄ folders segmented toggle; the choice persists (AC §D.1). */
  private renderViewToggle(): void {
    this.viewToggleEl.empty();
    const modes: { mode: ViewMode; icon: string; label: string }[] = [
      { mode: "timeline", icon: "list", label: "Timeline view" },
      { mode: "folders", icon: "folder", label: "Folder view" },
    ];
    for (const { mode, icon, label } of modes) {
      const btn = this.viewToggleEl.createEl("button", {
        cls: "thino-files-viewtoggle-btn clickable-icon",
        attr: { "aria-label": label, title: label },
      });
      setIcon(btn, icon);
      btn.toggleClass("is-active", this.plugin.settings.viewMode === mode);
      btn.addEventListener("click", () => {
        if (this.plugin.settings.viewMode === mode) return;
        this.plugin.settings.viewMode = mode;
        void this.plugin.saveSettings();
        this.renderViewToggle();
        this.renderList();
      });
    }
  }

  private renderList(): void {
    this.listEl.empty();
    const inScope = this.posts.filter((p) => matchScope(p, this.listScope));
    const visible = inScope.filter(
      (p) =>
        matchPost(p, this.query) &&
        (!this.selectedDay || p.date.slice(0, 10) === this.selectedDay)
    );
    if (visible.length === 0) {
      this.listEl.createDiv({
        cls: "thino-files-empty",
        text: inScope.length === 0
          ? this.listScope === "timeline"
            ? "No posts yet — write one above."
            : "Nothing here."
          : "No posts match the filter.",
      });
      return;
    }
    if (this.plugin.settings.viewMode === "folders") {
      this.renderGroups(visible);
      return;
    }
    for (const post of visible) {
      this.createCard(post, this.listEl);
    }
  }

  /** Folder view: collapsible group per subfolder, post counts (AC §D.3). */
  private renderGroups(visible: Post[]): void {
    const folder = normalizeFolder(this.plugin.settings.postsFolder);
    for (const group of groupByFolder(visible, folder)) {
      const groupEl = this.listEl.createDiv({ cls: "thino-files-group" });
      const headerEl = groupEl.createDiv({ cls: "thino-files-group-header" });
      const chevron = headerEl.createSpan({ cls: "thino-files-group-chevron" });
      headerEl.createSpan({ cls: "thino-files-group-name", text: group.name });
      headerEl.createSpan({
        cls: "thino-files-group-count",
        text: String(group.posts.length),
      });
      const bodyEl = groupEl.createDiv({ cls: "thino-files-group-body" });

      const apply = (): void => {
        const collapsed = this.collapsedGroups.has(group.name);
        setIcon(chevron, collapsed ? "chevron-right" : "chevron-down");
        bodyEl.toggle(!collapsed);
      };
      headerEl.addEventListener("click", () => {
        if (this.collapsedGroups.has(group.name)) {
          this.collapsedGroups.delete(group.name);
        } else {
          this.collapsedGroups.add(group.name);
        }
        apply();
      });

      for (const post of group.posts) {
        this.createCard(post, bodyEl);
      }
      apply();
    }
  }

  private createCard(post: Post, parent: HTMLElement): PostCard {
    return new PostCard(parent, post, {
      app: this.app,
      settings: this.plugin.settings,
      component: this,
      scope: this.listScope,
      openPost: (p) => this.openPost(p),
      savePost: async (p, newBody) => {
        const saved = await updatePost(this.vault, p, newBody);
        const i = this.posts.findIndex((x) => x.path === p.path);
        if (i >= 0) this.posts[i] = saved;
        // Only the edited card re-renders (SPEC §8); the watcher's debounced
        // full refresh will reconcile shortly after.
        return saved;
      },
      setFlags: async (p, flags) => {
        const saved = await setPostFlags(this.vault, p, flags);
        const i = this.posts.findIndex((x) => x.path === p.path);
        if (i >= 0) this.posts[i] = saved;
        // The card likely left the current scope — re-render list + counts.
        this.sidebar.update(this.posts, this.listScope);
        this.renderList();
        return saved;
      },
      deleteForever: async (p) => {
        await deletePost(this.vault, p.path);
        this.posts = this.posts.filter((x) => x.path !== p.path);
        this.sidebar.update(this.posts, this.listScope);
      },
    });
  }

  /** Open the underlying .md in an editor pane, cursor at line 1 (AC §2.5). */
  private async openPost(post: Post): Promise<void> {
    const file = this.vault.getAbstractFileByPath(post.path);
    if (!(file instanceof TFile)) return;
    const leaf = this.app.workspace.getLeaf(
      this.plugin.settings.openInNewPane ? "tab" : false
    );
    await leaf.openFile(file, { eState: { line: 0 } });
  }
}
