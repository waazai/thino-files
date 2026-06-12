import { Plugin } from "obsidian";
import { TimelineView, VIEW_TYPE_THINO_FILES } from "./TimelineView";
import { DEFAULT_SETTINGS, type ThinoFilesSettings } from "./types";

export default class ThinoFilesPlugin extends Plugin {
  settings: ThinoFilesSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_THINO_FILES,
      (leaf) => new TimelineView(leaf, this)
    );
    this.addRibbonIcon("messages-square", "Open Thino timeline", () => {
      void this.activateView();
    });
    this.addCommand({
      id: "open-timeline",
      name: "Open timeline",
      callback: () => void this.activateView(),
    });
  }

  onunload(): void {}

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_THINO_FILES)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_THINO_FILES, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
