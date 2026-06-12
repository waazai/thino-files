import { setIcon } from "obsidian";
import { matchScope, type PostScope } from "./filter";
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
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Left sidebar (SPEC §2.A): status counters, heatmap, calendar, scope list. */
export class Sidebar {
  readonly el: HTMLElement;
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
    this.statusEl = this.el.createDiv({ cls: "thino-files-status" });
    this.heatmapEl = this.el.createDiv({ cls: "thino-files-heatmap" });
    this.calendarEl = this.el.createDiv({ cls: "thino-files-calendar" });
    this.scopesEl = this.el.createDiv({ cls: "thino-files-scopes" });
    this.month = { year: today.getFullYear(), month: today.getMonth() };
  }

  /** Re-render from the full post list; called on every view refresh (AC §A.5). */
  update(posts: Post[], scope: PostScope): void {
    this.posts = posts;
    this.scope = scope;
    // Stats/heatmap/calendar count only non-deleted posts (AC §C.5).
    const counted = posts.filter((p) => !p.deleted);
    const perDay = postsPerDay(counted);
    this.renderStatus(counted);
    this.renderHeatmap(perDay);
    this.renderCalendar(perDay);
    this.renderScopes();
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
      { scope: "archived", icon: "archive", label: "Archived" },
      { scope: "trash", icon: "trash-2", label: "Recycle bin" },
    ];
    for (const { scope, icon, label } of scopes) {
      const count = this.posts.filter((p) => matchScope(p, scope)).length;
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
