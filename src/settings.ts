import { type App, PluginSettingTab, Setting } from "obsidian";
import type ThinoFilesPlugin from "./main";
import { DEFAULT_SETTINGS, type ThinoFilesSettings } from "./types";

/**
 * Type-checked overlay of persisted data onto defaults — wrongly-typed or
 * unknown keys from a hand-edited data.json are dropped.
 */
export function mergeSettings(stored: unknown): ThinoFilesSettings {
  const merged = { ...DEFAULT_SETTINGS };
  if (typeof stored !== "object" || stored === null) return merged;
  const data = stored as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof ThinoFilesSettings)[]) {
    const value = data[key];
    if (typeof value === typeof DEFAULT_SETTINGS[key]) {
      (merged as Record<string, unknown>)[key] = value;
    }
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

    new Setting(containerEl)
      .setName("Posts folder")
      .setDesc("Vault folder the timeline reads from and posts into.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.postsFolder)
          .setValue(this.plugin.settings.postsFolder)
          .onChange((value) =>
            update((s) => {
              s.postsFolder = value.trim() || DEFAULT_SETTINGS.postsFolder;
            })
          )
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
