# iPadOS Compatibility Inspection — thino-files

**Scope:** Problems preventing or degrading plugin use on iPadOS Obsidian.  
**Target user:** External keyboard (Magic Keyboard ± trackpad). Touch still primary pointer.  
**Mode:** Document problems only — no fix code.

---

## Summary

| # | Problem | Severity | Breaks what |
|---|---------|----------|-------------|
| P1 | Action buttons hidden without trackpad hover | Critical | Edit / Archive / Delete / Open |
| P2 | Media attach has no iOS code path | High | Attaching images/files |
| P3 | `bodyEl.focus()` post-submit fires virtual keyboard | Medium | UX after posting |
| P4 | `clientHeight` flickers during keyboard show/hide | Medium | Overflow measurement, sidebar |
| P5 | Confirmation popover has no dismiss-on-outside-tap | Low | Delete confirm UX |
| P6 | Edit textarea scrolling with virtual keyboard open | Low | In-card editing |
| P7 | Sidebar squeezes timeline when manually opened on narrow screen | Medium | Readable timeline |

**Triage decision (this session):** P2, P4 dismissed (drag-drop/clipboard out of
scope; keyboard-resize handled by the existing `null` guard, cosmetic only).
Active list: **P1, P3, P7**. P5/P6 low, deferred.

---

## P1 — Action buttons hidden without trackpad hover

**Severity:** Critical (touch pointer) / None (trackpad pointer)

**Location:** [styles.css:187–195](styles.css)

```css
.thino-files-card-actions {
  opacity: 0;                /* hidden by default */
}
.thino-files-card:hover .thino-files-card-actions {
  opacity: 1;                /* only shown on pointer hover */
}
```

**Root cause:** Edit, Archive, Delete, and Open source file are all inside `.thino-files-card-actions`. The entire element is `opacity: 0` unless `:hover` is active on the parent card. On iPadOS:

- **With Magic Keyboard trackpad:** the trackpad pointer fires real `mouseover`/`mouseenter` events → `:hover` works → actions visible. No problem.
- **With keyboard-only (no trackpad):** touch is the only pointer. A tap fires a brief synthetic hover that is immediately removed — the actions flash invisible. User cannot access any card action.

**Affected flow:** Every card action: edit, open in editor, archive, soft-delete, hard-delete, unarchive, restore.

**Not affected:** Post creation (Composer), filter bar, task checkbox toggling, Show more/less toggle.

---

## P2 — Media attach has no iOS code path

**Severity:** High

**Location:** [src/media.ts:20–36](src/media.ts), [src/Composer.ts:23](src/Composer.ts), [src/PostCard.ts:263](src/PostCard.ts)

**Root cause:** `bindAttachments()` registers exactly two event handlers:

```ts
textarea.addEventListener("paste", (e) => {
  if (e.clipboardData?.files.length) { … }  // clipboard file
});
textarea.addEventListener("drop", (e) => {
  if (e.dataTransfer?.files.length) { … }  // drag-drop file
});
```

On iPadOS:

- **`drop`:** Drag-and-drop of files from the Files app into a WKWebView is not supported. The `drop` event fires but `dataTransfer.files` is always empty.
- **`paste` with `clipboardData.files`:** Safari on iOS blocks file access via `clipboardData.files` (returns `FileList` length 0 even when an image is on the clipboard). The only paste that works is plain-text paste, which falls through to the browser default — correct behavior, but no file.
- **No `<input type="file">` fallback:** There is no file picker button anywhere in Composer or the edit card.

**Result:** 100% of media attach paths fail silently on iPadOS. No error is shown; the paste/drop just does nothing.

---

## P3 — `bodyEl.focus()` post-submit triggers virtual keyboard

**Severity:** Medium

**Location:** [src/Composer.ts:61](src/Composer.ts)

```ts
await this.onSubmit(…);
this.bodyEl.value = "";
// …
this.bodyEl.focus();   // ← fires here
```

**Root cause:** After a successful post the composer programmatically focuses the body textarea. On iOS, any programmatic `element.focus()` call opens the virtual keyboard — even if the user just dismissed it to tap "Post". With an external keyboard attached, the keyboard is always available, but on pure-touch or when the hardware keyboard is folded away (e.g. Magic Keyboard propped in keyboard-away mode), the virtual keyboard appears unexpectedly after every post.

**Impact:** Jarring UX; the virtual keyboard appearing shifts the layout, compresses the visible timeline, and may trigger an `onResize()` + `clientHeight === 0` cycle (see P4).

---

## P4 — `clientHeight` flickers when iOS virtual keyboard opens/closes

**Severity:** Medium

**Location:** [src/TimelineView.ts:142–151](src/TimelineView.ts) (`onResize`), [src/PostCard.ts:100–135](src/PostCard.ts) (`applyCollapse`)

**Root cause:** When the iOS virtual keyboard opens or closes, the WKWebView resizes the visual viewport. Obsidian fires the `onResize()` hook on the active leaf. Two cascading effects:

1. **Sidebar auto-collapse:** `onResize()` checks `this.contentEl.clientWidth < 600`. During the keyboard animation, `clientWidth` may briefly report a smaller value than stable, potentially toggling `sidebarHidden` unintentionally.

2. **Overflow measurement:** `applyCollapse()` calls `overflowState(scrollHeight, clientHeight)`. During the resize animation, `clientHeight` can be 0 (element not yet reflowed), returning `null` — which activates `observeForLayout()` and installs a `ResizeObserver` on every visible card. Once layout stabilises, each observer fires and re-runs `applyCollapse()`. On a long timeline this is a lot of wasted work.

**The guard works correctly** (`null` → keep clamped), so this is a performance/churn issue rather than a correctness bug. But on older iPad hardware (A12 or earlier) the observer storm during keyboard animation is noticeable.

---

## P5 — Confirmation popover has no dismiss-on-outside-tap

**Severity:** Low

**Location:** [src/PostCard.ts:233–243](src/PostCard.ts)

```ts
const popover = this.el.createDiv({ cls: "thino-files-card-confirm" });
// … Yes / Cancel buttons only; no backdrop, no outside-click handler
```

**Root cause:** The delete/delete-forever confirmation renders as a child `div` with two buttons. On desktop, users naturally click elsewhere to "cancel". The Cancel button handles this case explicitly. On iPadOS:

- Tapping outside the popover on a different card fires that card's click handler, not a dismiss. The popover stays open across card interactions.
- With no backdrop, there is no visual indication of modal state.
- Scrolling the timeline while a popover is open leaves the popover floating over unrelated cards (it is position-relative to the card, so it scrolls with it — this part is fine, but the open state persists until Cancel is explicitly tapped).

**Impact:** Minor UX confusion; never blocks the user (Cancel is always reachable).

---

## P6 — Edit textarea clipped by virtual keyboard in timeline scroll container

**Severity:** Low

**Location:** [src/PostCard.ts:248–278](src/PostCard.ts) (`enterEditMode`)

**Root cause:** The edit textarea is rendered inline inside `.thino-files-list`, which is a scrollable container. When the virtual keyboard opens on iOS, the browser attempts to scroll the focused element into view. However, in a nested-scroll context (Obsidian's leaf scroll + the list's scroll), the OS-level scroll-to-focus may scroll the wrong ancestor, leaving the textarea partially hidden behind the keyboard.

This affects both external-keyboard users (when keyboard is attached) and touch users. The standard fix (`scrollIntoView`, `visualViewport` adjustment, or `position: sticky` for the edit buttons) is not implemented.

**Impact:** User may need to manually scroll to see the Save/Cancel buttons when editing a card near the bottom of the visible list.

---

## P7 — Sidebar squeezes the timeline when manually opened on a narrow screen

**Severity:** Medium

**Location:** [styles.css:315–332](styles.css) (layout), [src/TimelineView.ts:142–151](src/TimelineView.ts) (`onResize`), [src/TimelineView.ts:113–122](src/TimelineView.ts) (toggle button)

**Default behaviour (correct):** `onResize()` auto-hides the sidebar below
`NARROW_WIDTH = 600px` by setting `sidebarHidden = true`, which applies
`.sidebar-hidden .thino-files-sidebar { display: none }`. The timeline then takes
the **full width** — not squeezed, not overlaid. On a phone-width vertical screen
this is the resting state and it works.

**The bug:** the sidebar toggle button lets the user re-open the sidebar while the
pane is still narrow. The layout CSS has **no narrow-screen override**, so it falls
back to the desktop rule:

```css
.thino-files-layout { display: flex; }       /* row */
.thino-files-sidebar { flex: 0 0 220px; }     /* fixed 220px, never shrinks */
.thino-files-main    { flex: 1; min-width: 0; }
```

On a ~400px-wide phone: a fixed 220px sidebar + gap leaves ~150px for the
timeline. Cards become unreadable — date chip, tags, and body all crush into a
sliver. The sidebar **squeezes** the timeline rather than overlaying it.

**Screen-size matrix:**

| Width | Sidebar default | If user toggles it on |
|-------|-----------------|------------------------|
| Phone portrait (~400px) | Hidden, full-width timeline ✓ | Squeezed to ~150px ✗ |
| Tablet portrait (~768–834px) | Visible 220px + timeline ✓ | n/a (already visible) ✓ |
| Desktop / landscape (>600px) | Visible 220px + timeline ✓ | n/a ✓ |

**Fix direction:** below 600px, float the sidebar as an overlay instead of an
inline flex child, so manual-open covers the timeline rather than crushing it:

```css
@media (max-width: 600px) {
  .thino-files-layout:not(.sidebar-hidden) .thino-files-sidebar {
    position: absolute; z-index: 10;
    background: var(--background-primary);
  }
}
```

---

## Not a Problem on iPadOS

| Item | Reason safe |
|------|-------------|
| `Cmd/Ctrl+Enter` keyboard shortcut | `metaKey` fires correctly on Magic Keyboard; `ctrlKey` fires on Ctrl+Enter |
| `IntersectionObserver` (infinite scroll) | Supported since iOS 12; current iPadOS (16+) fully compatible |
| `ResizeObserver` guard | `typeof ResizeObserver === "undefined"` check avoids crash on jsdom; iPadOS has it |
| `vault.*` file I/O | Obsidian abstracts FS; identical on mobile |
| `MarkdownRenderer.render()` | Obsidian API; same on mobile |
| `isDesktopOnly: false` in manifest | Correctly set — plugin is declared mobile-compatible |
