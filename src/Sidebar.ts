import { setIcon } from "obsidian";
import { matchScope, type PostScope } from "./filter";
import { extractImageEmbeds } from "./media-grid";
import {
  calendarGrid,
  computeStatus,
  heatmapCells,
  postsPerDay,
} from "./stats";
import type { Post } from "./types";

export interface SidebarCallbacks {
  onScopeChange: (scope: PostScope) => void;
  /** Day filter toggled from the calendar; null clears it (AC §A.4). */
  onDaySelect: (day: string | null) => void;
  /** Active source folder picked from the top-of-sidebar dropdown (AC §I.3). */
  onSourceChange: (folder: string) => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Left sidebar (SPEC §2.A): status counters, heatmap, calendar, scope list. */
export class Sidebar {
  readonly el: HTMLElement;
  private sourceEl: HTMLElement;
  private statusEl: HTMLElement;
  private heatmapEl: HTMLElement;
  private calendarEl: HTMLElement;
  private scopesEl: HTMLElement;

  private posts: Post[] = [];
  private scope: PostScope = "timeline";
  private selectedDay: string | null = null;
  private month: { year: number; month: number };

  constructor(
    parent: HTMLElement,
    private callbacks: SidebarCallbacks,
    private today: Date = new Date()
  ) {
    this.el = parent.createDiv({ cls: "thino-files-sidebar" });
    // Source-folder dropdown sits above the stats (AC §I.1).
    this.sourceEl = this.el.createDiv({ cls: "thino-files-source" });
    this.statusEl = this.el.createDiv({ cls: "thino-files-status" });
    this.heatmapEl = this.el.createDiv({ cls: "thino-files-heatmap" });
    this.calendarEl = this.el.createDiv({ cls: "thino-files-calendar" });
    this.scopesEl = this.el.createDiv({ cls: "thino-files-scopes" });
    this.month = { year: today.getFullYear(), month: today.getMonth() };
  }

  /** Re-render from the full post list; called on every view refresh (AC §A.5). */
  update(
    posts: Post[],
    scope: PostScope,
    sourceFolders: string[],
    activeFolder: string
  ): void {
    this.posts = posts;
    this.scope = scope;
    // Stats/heatmap/calendar count only non-deleted posts (AC §C.5).
    const counted = posts.filter((p) => !p.deleted);
    const perDay = postsPerDay(counted);
    this.renderSource(sourceFolders, activeFolder);
    this.renderStatus(counted);
    this.renderHeatmap(perDay);
    this.renderCalendar(perDay);
    this.renderScopes();
  }

  /** Source-folder selector above the stats; always shown (AC §I.1, I.2). */
  private renderSource(folders: string[], active: string): void {
    this.sourceEl.empty();
    this.sourceEl.createSpan({ cls: "thino-files-source-label", text: "Source" });
    const select = this.sourceEl.createEl("select", {
      cls: "dropdown thino-files-source-select",
      attr: { "aria-label": "Source folder" },
    });
    // Ignore transient blank rows still being edited in settings.
    const options = [...new Set(folders.map((f) => f.trim()).filter(Boolean))];
    for (const folder of options) {
      const opt = select.createEl("option", { text: folder, value: folder });
      if (folder === active) opt.selected = true;
    }
    select.addEventListener("change", () =>
      this.callbacks.onSourceChange(select.value)
    );
  }

  private renderStatus(counted: Post[]): void {
    this.statusEl.empty();
    const status = computeStatus(counted);
    const items: [number, string][] = [
      [status.posts, "Posts"],
      [status.tags, "Tags"],
      [status.days, "Days"],
    ];
    for (const [value, label] of items) {
      const item = this.statusEl.createDiv({ cls: "thino-files-status-item" });
      item.createDiv({ cls: "thino-files-status-value", text: String(value) });
      item.createDiv({ cls: "thino-files-status-label", text: label });
    }
  }

  private renderHeatmap(perDay: Map<string, number>): void {
    this.heatmapEl.empty();
    for (const cell of heatmapCells(perDay, this.today)) {
      this.heatmapEl.createDiv({
        cls: `thino-files-heat-cell thino-files-heat-${cell.bucket}`,
        attr: { title: `${cell.count} post${cell.count === 1 ? "" : "s"} on ${cell.day}` },
      });
    }
  }

  private renderCalendar(perDay: Map<string, number>): void {
    this.calendarEl.empty();
    const { year, month } = this.month;

    const header = this.calendarEl.createDiv({ cls: "thino-files-cal-header" });
    const prev = header.createEl("button", {
      cls: "thino-files-cal-nav clickable-icon",
      attr: { "aria-label": "Previous month" },
    });
    setIcon(prev, "chevron-left");
    header.createSpan({
      cls: "thino-files-cal-title",
      text: `${MONTHS[month]} ${year}`,
    });
    const next = header.createEl("button", {
      cls: "thino-files-cal-nav clickable-icon",
      attr: { "aria-label": "Next month" },
    });
    setIcon(next, "chevron-right");
    prev.addEventListener("click", () => this.shiftMonth(-1, perDay));
    next.addEventListener("click", () => this.shiftMonth(1, perDay));

    const grid = this.calendarEl.createDiv({ cls: "thino-files-cal-grid" });
    for (const wd of WEEKDAYS) {
      grid.createDiv({ cls: "thino-files-cal-weekday", text: wd });
    }
    for (const cell of calendarGrid(year, month, perDay).flat()) {
      const dayEl = grid.createDiv({
        cls: "thino-files-cal-day",
        text: String(cell.dayOfMonth),
      });
      dayEl.toggleClass("is-outside", !cell.inMonth);
      dayEl.toggleClass("is-selected", cell.day === this.selectedDay);
      if (cell.count > 0) dayEl.createDiv({ cls: "thino-files-cal-dot" });
      dayEl.addEventListener("click", () => {
        this.selectedDay = this.selectedDay === cell.day ? null : cell.day;
        this.callbacks.onDaySelect(this.selectedDay);
        this.renderCalendar(perDay);
      });
    }
  }

  private shiftMonth(delta: number, perDay: Map<string, number>): void {
    const d = new Date(this.month.year, this.month.month + delta, 1);
    this.month = { year: d.getFullYear(), month: d.getMonth() };
    this.renderCalendar(perDay);
  }

  private renderScopes(): void {
    this.scopesEl.empty();
    const scopes: { scope: PostScope; icon: string; label: string }[] = [
      { scope: "timeline", icon: "messages-square", label: "Timeline" },
      { scope: "media", icon: "image", label: "Media" },
      { scope: "archived", icon: "archive", label: "Archived" },
      { scope: "trash", icon: "trash-2", label: "Recycle bin" },
    ];
    for (const { scope, icon, label } of scopes) {
      // Media counts image embeds across qualifying posts (AC §F.1); other
      // scopes count posts.
      const count =
        scope === "media"
          ? this.posts
              .filter((p) => matchScope(p, "media"))
              .reduce((sum, p) => sum + extractImageEmbeds(p.body).length, 0)
          : this.posts.filter((p) => matchScope(p, scope)).length;
      const row = this.scopesEl.createDiv({ cls: "thino-files-scope-row" });
      row.toggleClass("is-active", scope === this.scope);
      const iconEl = row.createSpan({ cls: "thino-files-scope-icon" });
      setIcon(iconEl, icon);
      row.createSpan({ cls: "thino-files-scope-label", text: label });
      row.createSpan({ cls: "thino-files-scope-count", text: String(count) });
      row.addEventListener("click", () => this.callbacks.onScopeChange(scope));
    }
  }
}
