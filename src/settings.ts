import {
  type App,
  FuzzySuggestModal,
  PluginSettingTab,
  Setting,
  TFolder,
} from "obsidian";
import type ThinoFilesPlugin from "./main";
import { DEFAULT_SETTINGS, type ThinoFilesSettings } from "./types";

/** In-app folder "browse": pick a vault folder to add as a source (AC §G.1). */
class FolderPickerModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private exclude: Set<string>,
    private onPick: (path: string) => void
  ) {
    super(app);
    this.setPlaceholder("Pick a folder to add as a source");
  }

  // Every vault folder except the root and already-configured sources.
  getItems(): TFolder[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((f): f is TFolder => f instanceof TFolder)
      .filter((f) => f.path !== "" && !this.exclude.has(f.path));
  }

  getItemText(folder: TFolder): string {
    return folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.onPick(folder.path);
  }
}

/**
 * Type-checked overlay of persisted data onto defaults — wrongly-typed or
 * unknown keys from a hand-edited data.json are dropped.
 */
export function mergeSettings(stored: unknown): ThinoFilesSettings {
  const merged = {
    ...DEFAULT_SETTINGS,
    sourceFolders: [...DEFAULT_SETTINGS.sourceFolders],
  };
  if (typeof stored !== "object" || stored === null) return merged;
  const data = stored as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof ThinoFilesSettings)[]) {
    // sourceFolders is an array — the scalar typeof check below can't validate
    // it (a non-array object would slip through); handled separately after.
    if (key === "sourceFolders") continue;
    const value = data[key];
    if (typeof value === typeof DEFAULT_SETTINGS[key]) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  // sourceFolders: keep the valid (non-empty, trimmed string) entries and drop
  // the rest — a stray blank/garbage entry never wipes the whole list. An empty
  // result seeds from the (already-merged) active folder (legacy migration).
  const raw = data.sourceFolders;
  const cleaned = Array.isArray(raw)
    ? raw
        .filter((f): f is string => typeof f === "string" && f.trim() !== "")
        .map((f) => f.trim())
    : [];
  merged.sourceFolders = cleaned.length > 0 ? cleaned : [merged.postsFolder];

  // Invariant: the active folder is always one of the configured sources.
  if (!merged.sourceFolders.includes(merged.postsFolder)) {
    merged.postsFolder = merged.sourceFolders[0];
  }

  // sortOrder is a string union — the scalar typeof check above lets any string
  // through, so clamp an unknown value back to the default.
  if (merged.sortOrder !== "asc" && merged.sortOrder !== "desc") {
    merged.sortOrder = DEFAULT_SETTINGS.sortOrder;
  }
  return merged;
}

export class ThinoFilesSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ThinoFilesPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const update = async (
      apply: (s: ThinoFilesSettings) => void
    ): Promise<void> => {
      apply(this.plugin.settings);
      await this.plugin.saveSettings();
      this.plugin.refreshTimelines();
    };

    const settings = this.plugin.settings;

    // Non-blank, de-duped source folders for the active picker. Blank rows are
    // allowed transiently in the editor below and are cleaned on close (hide()).
    const folders = (): string[] => {
      const list = settings.sourceFolders.map((f) => f.trim()).filter(Boolean);
      return list.length ? [...new Set(list)] : [DEFAULT_SETTINGS.postsFolder];
    };

    // Which configured source folder is currently shown (AC §G.2).
    new Setting(containerEl)
      .setName("Active source folder")
      .setDesc("The source folder the timeline currently reads from and posts into.")
      .addDropdown((dd) => {
        const options = folders();
        for (const folder of options) dd.addOption(folder, folder);
        const active = options.includes(settings.postsFolder)
          ? settings.postsFolder
          : options[0];
        dd.setValue(active);
        dd.onChange((value) => update((s) => {
          s.postsFolder = value;
        }));
      });

    // Read-only list of source folders: add via the folder picker, remove via
    // the trash button (AC §G.1). The last source can't be removed.
    new Setting(containerEl).setName("Source folders").setHeading();
    settings.sourceFolders.forEach((folder, i) => {
      new Setting(containerEl)
        .setName(folder)
        .addExtraButton((btn) =>
          btn
            .setIcon("trash")
            .setTooltip("Remove this source folder")
            .setDisabled(settings.sourceFolders.length <= 1)
            .onClick(async () => {
              settings.sourceFolders.splice(i, 1);
              if (!folders().includes(settings.postsFolder)) {
                settings.postsFolder = folders()[0];
              }
              await this.plugin.saveSettings();
              this.plugin.refreshTimelines();
              this.display();
            })
        );
    });
    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("Add folder").setCta().onClick(() => {
        new FolderPickerModal(this.app, new Set(settings.sourceFolders), (path) => {
          if (settings.sourceFolders.includes(path)) return;
          settings.sourceFolders.push(path);
          void this.plugin.saveSettings();
          this.plugin.refreshTimelines();
          this.display();
        }).open();
      })
    );

    new Setting(containerEl)
      .setName("Assets folder")
      .setDesc("Where pasted/dropped media is stored; excluded from the timeline.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.assetsFolder)
          .setValue(this.plugin.settings.assetsFolder)
          .onChange((value) =>
            update((s) => {
              s.assetsFolder = value.trim() || DEFAULT_SETTINGS.assetsFolder;
            })
          )
      );

    new Setting(containerEl)
      .setName("Filename date format")
      .setDesc("Date prefix for new post filenames (YYYY, MM, DD tokens).")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.filenameDateFormat)
          .setValue(this.plugin.settings.filenameDateFormat)
          .onChange((value) =>
            update((s) => {
              s.filenameDateFormat = value.trim() || DEFAULT_SETTINGS.filenameDateFormat;
            })
          )
      );

    new Setting(containerEl)
      .setName("Require slug on post")
      .setDesc("Block posting until a title/slug is entered.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.requireSlug)
          .onChange((value) => update((s) => {
            s.requireSlug = value;
          }))
      );

    new Setting(containerEl)
      .setName("Open in new pane")
      .setDesc("Open a post's source file in a new tab instead of the active pane.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openInNewPane)
          .onChange((value) => update((s) => {
            s.openInNewPane = value;
          }))
      );

    new Setting(containerEl)
      .setName("Date display format")
      .setDesc("How the date chip on each card is shown (YYYY, MM, DD, HH, mm, ss).")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.dateDisplayFormat)
          .setValue(this.plugin.settings.dateDisplayFormat)
          .onChange((value) =>
            update((s) => {
              s.dateDisplayFormat = value.trim() || DEFAULT_SETTINGS.dateDisplayFormat;
            })
          )
      );
  }
}
