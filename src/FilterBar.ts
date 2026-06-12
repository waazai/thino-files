import { parseQuery, type PostQuery } from "./filter";

/**
 * Search/filter bar: live-typed query plus committed chips (Enter). The
 * effective query is the union of all chips and the current input text.
 */
export class FilterBar {
  private inputEl: HTMLInputElement;
  private chipsEl: HTMLElement;
  private chips: string[] = [];

  constructor(parent: HTMLElement, private onChange: (query: PostQuery) => void) {
    const root = parent.createDiv({ cls: "thino-files-filterbar" });
    this.inputEl = root.createEl("input", {
      cls: "thino-files-filter-input",
      attr: {
        type: "search",
        placeholder: "Filter: text, #tag, from:YYYY-MM-DD to:YYYY-MM-DD",
      },
    });
    this.chipsEl = root.createDiv({ cls: "thino-files-filter-chips" });

    this.inputEl.addEventListener("input", () => this.emit());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.inputEl.value.trim()) {
        e.preventDefault();
        this.addChip(this.inputEl.value.trim());
        this.inputEl.value = "";
        this.emit();
      }
    });
  }

  private addChip(text: string): void {
    this.chips.push(text);
    const chip = this.chipsEl.createSpan({ cls: "thino-files-filter-chip" });
    chip.createSpan({ text });
    const removeBtn = chip.createSpan({ cls: "thino-files-filter-chip-x", text: "×" });
    removeBtn.addEventListener("click", () => {
      this.chips.remove(text);
      chip.remove();
      this.emit();
    });
  }

  private emit(): void {
    const combined = [...this.chips, this.inputEl.value].join(" ");
    this.onChange(parseQuery(combined));
  }
}
