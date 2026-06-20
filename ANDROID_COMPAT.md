# Android Compatibility Inspection — thino-files

**Scope:** Problems preventing or degrading plugin use on Android Obsidian.  
**Engine:** Obsidian Android uses Chromium WebView (not WebKit — different from iPadOS).  
**Target user:** Touch-only (most Android); external Bluetooth keyboard possible but no trackpad.

---

## Comparison to iPadOS findings

| # | Problem | iPadOS | Android | Delta |
|---|---------|--------|---------|-------|
| P1 | Action buttons hidden (hover gate) | Critical (no trackpad) | **Critical** | Same |
| P2 | Media attach broken | High (both paths fail) | **Medium** (paste works on Android 12+) | Better on Android |
| P3 | `bodyEl.focus()` fires virtual keyboard | Medium | **Medium** | Same |
| P4 | Layout measurement flicker (keyboard resize) | Medium | **High** (worse mechanism) | Worse on Android |
| P5 | Confirm popover no outside-tap dismiss | Low | Low | Same |
| P6 | Edit textarea clipped by keyboard | Low | Low | Same |
| A1 | Back button ignores edit / confirm state | N/A | **Medium** | Android-only |
| A2 | System font scaling breaks overflow calc | N/A | **Medium** | Android-only |
| A3 | IntersectionObserver sentinel fires on keyboard open | N/A | **Low** | Android-only |

---

## Inherited problems (same root cause as iPadOS)

### P1 — Action buttons hidden (Critical)

Identical to iPadOS: `.thino-files-card-actions { opacity: 0 }` revealed only by `.thino-files-card:hover`. Android touch has no persistent hover. No trackpad exists on standard Android devices, so this is universally broken for Android users.

### P2 — Media attach (Medium on Android, not High)

**Drop path:** Same as iPadOS — `dataTransfer.files` is always empty on Android WebView. Broken.

**Paste path:** Unlike iOS WKWebView, **Chromium WebView on Android 12+ (API 32+) does expose `clipboardData.files`** when the user pastes an image from the system clipboard via long-press → Paste. The existing paste handler at [src/media.ts:27](src/media.ts) works correctly in this case.

On Android < 12 (API < 32), `clipboardData.files` is empty — paste fails silently, same as iOS.

**No `<input type="file">` fallback:** Still absent. Android users on older OS have no media attach path.

### P3 — `bodyEl.focus()` fires virtual keyboard (Medium)

Same as iPadOS: [src/Composer.ts:61](src/Composer.ts) calls `this.bodyEl.focus()` after post. On Android this always opens the soft keyboard, regardless of whether one was visible before.

### P5 — Confirm popover no outside-tap dismiss (Low)

Same as iPadOS: no backdrop, no outside-tap handler at [src/PostCard.ts:233](src/PostCard.ts).

### P6 — Edit textarea clipped by keyboard (Low)

Same mechanism: inline textarea inside a scroll container; Android keyboard can obscure the Save/Cancel buttons.

---

## Android-specific problems

### P4 (worse) — Keyboard resize shrinks layout container height (High)

**Location:** [src/TimelineView.ts:142](src/TimelineView.ts) (`onResize`), [src/PostCard.ts:100](src/PostCard.ts) (`applyCollapse`)

**iPadOS behaviour:** iOS uses the Visual Viewport API — the page layout does *not* reflow; only the visible area shrinks. `contentEl.clientHeight` typically stays stable.

**Android behaviour:** Android WebView uses the `resize` model by default — the WebView itself shrinks when the keyboard opens. `contentEl.clientHeight` **actually decreases**. Obsidian fires `onResize()`.

Two consequences:

1. **Card overflow re-evaluation.** The list container (`listEl`) becomes shorter. `clientHeight` of each card body stays the same (the card is sized by content), but if any CSS `max-height` clamp is in `vh` or `%` units (context-dependent), it may change. More importantly, the `ResizeObserver` in `observeForLayout()` fires for every card currently observing (e.g. cards not yet measured), triggering a wave of `applyCollapse()` calls across the timeline on every keyboard open/close.

2. **Sentinel enters view.** `IntersectionObserver` at [src/TimelineView.ts:261](src/TimelineView.ts) uses `{ root: this.listEl, rootMargin: "200px" }`. When the list container shrinks, the sentinel (previously below the viewport) may enter the intersection zone and trigger `appendBatch()`, loading more posts even though the user hasn't scrolled. On a large vault, each keyboard open/close can force an extra batch render.

---

### A1 — Back button does not cancel edit or confirm state (Medium)

**Location:** [src/PostCard.ts:248](src/PostCard.ts) (`enterEditMode`), [src/PostCard.ts:233](src/PostCard.ts) (`confirm`)

**Root cause:** Android's hardware/software back button is the standard "cancel / go back" signal. Obsidian handles back at the app level — it navigates the workspace (closes panes, goes to previous leaf). Plugins have no `onBack()` hook to intercept it.

**Result:** If the user is in inline edit mode or has a delete confirmation open and presses back:
- Obsidian may close the timeline leaf entirely, losing the unsaved edit silently.
- Or Obsidian navigates to the previous leaf, leaving the timeline in edit/confirm state — the next time it is opened, it re-renders from scratch (clears the state), so no corruption, but the user's partially typed edit is lost without warning.

**No equivalent on iPadOS:** iPad keyboard has no back button; Cmd+W or the close-leaf button are deliberate actions.

---

### A2 — System font scaling breaks overflow calculations (Medium)

**Location:** [styles.css](styles.css) (wherever `.thino-files-card-body` max-height is defined), [src/PostCard.ts:100](src/PostCard.ts) (`applyCollapse`)

**Root cause:** Android allows system-level font size at 85%, 100%, 115%, 130%, 180%, 200%. Obsidian respects `textScaleFactor`. If `.thino-files-card-body` is clamped at a fixed `max-height` in `em` or `rem`, a 200% font setting doubles the effective clamp height — each card can show only half the lines before being clamped. Nearly every card on a large-font Android will show "Show more", which is correct behaviour from the overflow logic's perspective but very poor UX.

More critically: if the font scale changes while the plugin is open (Settings → Display), `onResize()` fires but the already-rendered cards are not re-evaluated. Cards rendered at 100% that fit without a toggle now overflow at 200% — they show no toggle and render truncated by the gradient fade with no way to expand them, until the timeline is re-opened.

**iPadOS note:** iOS Dynamic Type affects Obsidian similarly, but users rarely change it mid-session; iOS does not fire `resize` when font scale changes. On Android it can be changed live in Quick Settings.

---

### A3 — Sentinel fires on keyboard open (Low)

Described under P4 above. Isolated here for visibility: every keyboard open/close cycle on Android can trigger one `appendBatch()` call, appending the next page of posts without user scroll intent. On a vault with thousands of posts, this is an invisible background load that may cause jank during the keyboard animation. Correctness is unaffected (the posts render correctly), but it undermines the purpose of incremental reveal.

---

## Not a problem on Android

| Item | Reason safe |
|------|-------------|
| `Ctrl+Enter` shortcut | Chromium WebView fires `ctrlKey: true` correctly on Bluetooth keyboard |
| `Escape` to cancel edit | Chromium WebView supports `e.key === "Escape"` from physical keyboard |
| `IntersectionObserver` | Chromium-based; full support |
| `ResizeObserver` | Chromium-based; full support; the guard `typeof ResizeObserver === "undefined"` is never hit |
| `vault.*` file I/O | Obsidian abstracts FS; identical on Android |
| `MarkdownRenderer.render()` | Obsidian API; identical on Android |
| `isDesktopOnly: false` | Correctly declared; plugin loads on Android |
