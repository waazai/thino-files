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
  buildMarkdownLink,
  createPost,
  deletePost,
  formatDate,
  listPosts,
  normalizeFolder,
  saveAsset,
  setPostFlags,
  updatePost,
} from "./fileManager";
import { FilterBar } from "./FilterBar";
import { matchPost, matchScope, parseQuery, type PostQuery, type PostScope } from "./filter";
import { extractImageEmbeds } from "./media-grid";
import type ThinoFilesPlugin from "./main";
import { clampReveal, growReveal, hasMore, initialReveal } from "./pagination";
import { PostCard } from "./PostCard";
import { Sidebar } from "./Sidebar";
import type { Post } from "./types";

/** Container width (px) under which the sidebar auto-collapses (AC §A.1). */
const NARROW_WIDTH = 600;

/** Markdown image targets URL-encode spaces; decode for linkpath resolution. */
function decodeLinkpath(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

export const VIEW_TYPE_THINO_FILES = "thino-files-timeline";

export class TimelineView extends ItemView {
  private layoutEl!: HTMLElement;
  private listEl!: HTMLElement;
  private sidebar!: Sidebar;
  private posts: Post[] = [];
  private query: PostQuery = parseQuery("");
  private listScope: PostScope = "timeline";
  /** Calendar day filter (YYYY-MM-DD), ANDed with the filter bar (AC §A.4). */
  private selectedDay: string | null = null;
  private sidebarHidden = false;

  /** §2.O incremental render state. `visiblePosts` is the current filtered list;
   * `revealed` cards of it are in the DOM; the sentinel + observer reveal more. */
  private visiblePosts: Post[] = [];
  private revealed = 0;
  private observer: IntersectionObserver | null = null;
  private sentinelEl: HTMLElement | null = null;
  /** Live cards in the DOM, so a resize can re-measure their overflow clamp (A2). */
  private cards: PostCard[] = [];

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
        this.updateSidebar();
        this.renderList();
      },
      onDaySelect: (day) => {
        this.selectedDay = day;
        this.renderList();
      },
      onSourceChange: (folder) => {
        this.plugin.settings.postsFolder = folder;
        void this.plugin.saveSettings();
        void this.refresh();
      },
    });
    const main = this.layoutEl.createDiv({ cls: "thino-files-main" });

    new Composer(
      main,
      async (input) => {
        await createPost(this.vault, this.plugin.settings, input);
        // Refresh immediately so the new post appears at the top without
        // waiting for the file watcher (AC §2.1).
        await this.refresh();
      },
      (file) => this.attachFile(file)
    );

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
    // A resize also fires on a live system-font-scale change (notably Android);
    // re-measure each card so newly-overflowing bodies gain a Show more toggle (A2).
    for (const card of this.cards) card.remeasure();
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
    this.updateSidebar();
    this.renderList({ preserve: true });
  }

  /** Push the current posts + active-source state into the sidebar. */
  private updateSidebar(): void {
    this.sidebar.update(
      this.posts,
      this.listScope,
      this.plugin.settings.sourceFolders,
      this.plugin.settings.postsFolder
    );
  }

  /**
   * @param opts.preserve §2.O: a *data* refresh (disk watcher, source switch,
   * composer post, card flag change) keeps the user where they are — it holds
   * the revealed count (AC O.7) and restores the scroll offset. The default
   * (filter / scope / day change) resets to the newest batch at the top (O.6).
   */
  private renderList(opts: { preserve?: boolean } = {}): void {
    const prevScroll = this.listEl.scrollTop;
    const prevRevealed = this.revealed;
    this.removeSentinel();
    this.listEl.empty();
    this.cards = [];
    const inScope = this.posts.filter((p) => matchScope(p, this.listScope));
    const visible = inScope.filter(
      (p) =>
        matchPost(p, this.query) &&
        (!this.selectedDay || p.date.slice(0, 10) === this.selectedDay)
    );
    // Media scope renders a grid of embeds, with its own empty state (AC §F.6).
    if (this.listScope === "media") {
      this.renderMediaGrid(visible);
      return;
    }
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
    // §2.O: render the newest batch only; the sentinel reveals more on scroll.
    this.visiblePosts = visible;
    this.revealed = opts.preserve
      ? clampReveal(prevRevealed, visible.length)
      : initialReveal(visible.length);
    for (const post of visible.slice(0, this.revealed)) {
      this.createCard(post, this.listEl);
    }
    this.installSentinel();
    // Resets jump to top (O.6); preserves keep the prior scroll offset (O.7).
    this.listEl.scrollTop = opts.preserve ? prevScroll : 0;
  }

  /**
   * §2.O: reveal the next batch when the user scrolls near the bottom. Cards are
   * appended after the existing ones — already-rendered cards (and their §M
   * expand state) are untouched. Re-installing the sentinel re-observes it, so a
   * sentinel that is still in view fires the callback again and self-fills the
   * viewport (AC O.5) until posts are exhausted (AC O.3).
   */
  private appendBatch(): void {
    const total = this.visiblePosts.length;
    if (!hasMore(this.revealed, total)) {
      this.removeSentinel();
      return;
    }
    const start = this.revealed;
    this.revealed = growReveal(this.revealed, total);
    this.removeSentinel();
    for (const post of this.visiblePosts.slice(start, this.revealed)) {
      this.createCard(post, this.listEl);
    }
    this.installSentinel();
  }

  /** Add the scroll sentinel + observer when posts remain hidden (AC O.4). */
  private installSentinel(): void {
    if (!hasMore(this.revealed, this.visiblePosts.length)) return;
    this.sentinelEl = this.listEl.createDiv({ cls: "thino-files-sentinel" });
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) this.appendBatch();
      },
      { root: this.listEl, rootMargin: "200px" }
    );
    this.observer.observe(this.sentinelEl);
  }

  /** Tear down the sentinel + its observer (AC O.3/O.10). */
  private removeSentinel(): void {
    this.disconnectObserver();
    this.sentinelEl?.remove();
    this.sentinelEl = null;
  }

  private disconnectObserver(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Release the scroll observer when the leaf closes (AC O.10). */
  async onClose(): Promise<void> {
    this.disconnectObserver();
  }

  /**
   * Media grid (AC §F): one tile per image embed found in the visible posts,
   * newest post first, embeds in body order. Each tile opens its source post.
   */
  private renderMediaGrid(visible: Post[]): void {
    const grid = this.listEl.createDiv({ cls: "thino-files-media-grid" });
    let tiles = 0;
    for (const post of visible) {
      for (const target of extractImageEmbeds(post.body)) {
        const file = this.app.metadataCache.getFirstLinkpathDest(
          decodeLinkpath(target),
          post.path
        );
        if (!(file instanceof TFile)) continue;
        const tile = grid.createDiv({
          cls: "thino-files-media-tile",
          attr: { title: this.displayDate(post.date) },
        });
        tile.createEl("img", {
          attr: { src: this.vault.getResourcePath(file), loading: "lazy" },
        });
        tile.addEventListener("click", () => void this.openPost(post));
        tiles++;
      }
    }
    if (tiles === 0) {
      grid.remove();
      this.listEl.createDiv({ cls: "thino-files-empty", text: "No media yet." });
    }
  }

  /** Card date chip formatting, shared with media tile tooltips. */
  private displayDate(date: string): string {
    const d = new Date(date);
    if (!date || isNaN(d.getTime())) return date;
    return formatDate(d, this.plugin.settings.dateDisplayFormat);
  }

  private createCard(post: Post, parent: HTMLElement): PostCard {
    const card = new PostCard(parent, post, {
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
        // Preserve scroll/reveal so acting on a deep card doesn't jump to top.
        this.updateSidebar();
        this.renderList({ preserve: true });
        return saved;
      },
      deleteForever: async (p) => {
        await deletePost(this.vault, p.path);
        this.posts = this.posts.filter((x) => x.path !== p.path);
        this.updateSidebar();
      },
    });
    this.cards.push(card);
    return card;
  }

  /** Save a pasted/dropped binary to the assets folder; returns its link. */
  private async attachFile(file: File): Promise<string> {
    const path = await saveAsset(
      this.vault,
      this.plugin.settings,
      file.name,
      await file.arrayBuffer()
    );
    return buildMarkdownLink(file.name, path);
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
