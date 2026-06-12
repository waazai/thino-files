// Minimal runtime stub of the `obsidian` module for unit tests.
// The real package ships type declarations only; the app provides the runtime.

export class TFile {
  path = "";
  basename = "";
  extension = "md";
}

export class TFolder {
  path = "";
  children: unknown[] = [];
}

export class Plugin {}
export class ItemView {}
export class PluginSettingTab {}
export class Setting {}
export class Notice {
  constructor(public message: string) {}
}

export const MarkdownRenderer = {
  render: async () => {},
};

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  _timeout?: number,
  _resetTimer?: boolean
): T {
  return fn;
}
