import { parseTagInput } from "./fileManager";

export interface ComposerSubmit {
  body: string;
  slug: string;
  tags: string[];
}

/** Top compose box: body textarea, slug + tags fields, Post button, Cmd/Ctrl+Enter. */
export class Composer {
  private bodyEl: HTMLTextAreaElement;
  private slugEl: HTMLInputElement;
  private tagsEl: HTMLInputElement;
  private errorEl: HTMLElement;

  constructor(
    parent: HTMLElement,
    private onSubmit: (input: ComposerSubmit) => Promise<void>
  ) {
    const root = parent.createDiv({ cls: "thino-files-composer" });
    this.bodyEl = root.createEl("textarea", {
      cls: "thino-files-composer-body",
      attr: { placeholder: "What's on your mind?", rows: "4" },
    });
    const row = root.createDiv({ cls: "thino-files-composer-row" });
    this.slugEl = row.createEl("input", {
      cls: "thino-files-composer-slug",
      attr: { type: "text", placeholder: "title/slug (optional)" },
    });
    this.tagsEl = row.createEl("input", {
      cls: "thino-files-composer-tags",
      attr: { type: "text", placeholder: "tags, comma-separated" },
    });
    const postBtn = row.createEl("button", { text: "Post", cls: "mod-cta" });
    this.errorEl = root.createDiv({ cls: "thino-files-composer-error" });
    this.errorEl.hide();

    postBtn.addEventListener("click", () => void this.submit());
    const keyHandler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void this.submit();
      }
    };
    this.bodyEl.addEventListener("keydown", keyHandler);
    this.slugEl.addEventListener("keydown", keyHandler);
    this.tagsEl.addEventListener("keydown", keyHandler);
  }

  private async submit(): Promise<void> {
    const body = this.bodyEl.value.trim();
    if (!body) {
      this.showError("Write something first.");
      return;
    }
    try {
      await this.onSubmit({
        body,
        slug: this.slugEl.value,
        tags: parseTagInput(this.tagsEl.value),
      });
      this.bodyEl.value = "";
      this.slugEl.value = "";
      this.tagsEl.value = "";
      this.errorEl.hide();
      this.bodyEl.focus();
    } catch (err) {
      this.showError(err instanceof Error ? err.message : String(err));
    }
  }

  private showError(message: string): void {
    this.errorEl.setText(message);
    this.errorEl.show();
  }
}
