import { insertAtCursor } from "./fileManager";

/** Saves one pasted/dropped file and returns the Markdown link to insert. */
export type AttachFn = (file: File) => Promise<string>;

/**
 * Paste/drop handler for a compose or edit textarea (AC §B.2): each file is
 * saved via `attach` and its link spliced in at the cursor. Plain-text paste
 * is left to the browser.
 */
export function bindAttachments(
  textarea: HTMLTextAreaElement,
  attach: AttachFn
): void {
  const insertLinks = async (files: FileList): Promise<void> => {
    for (const file of Array.from(files)) {
      const link = await attach(file);
      const at = textarea.selectionStart ?? textarea.value.length;
      const next = insertAtCursor(textarea.value, at, link);
      textarea.value = next.value;
      textarea.setSelectionRange(next.cursor, next.cursor);
    }
    textarea.focus();
  };

  textarea.addEventListener("paste", (e) => {
    if (e.clipboardData?.files.length) {
      e.preventDefault();
      void insertLinks(e.clipboardData.files);
    }
  });
  textarea.addEventListener("drop", (e) => {
    if (e.dataTransfer?.files.length) {
      e.preventDefault();
      void insertLinks(e.dataTransfer.files);
    }
  });
}
