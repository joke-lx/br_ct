# Options Focus Mode Scroll Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Options focus mode, keep the right-side dot navigation highlighted to the current iframe page, and enable wheel-at-edge auto page switching (with cyclic wrap) while respecting inner scrollable elements.

**Architecture:** The parent options shell (`options/options.js`) remains the single navigation authority (switches iframe src and updates active states). Each iframe subpage loads a small shared script that listens to `wheel` events, detects edge + extra scroll deltas, and sends `postMessage` to the parent requesting `next`/`prev`. Parent switches page, then instructs the new iframe to scroll to top/bottom.

**Tech Stack:** Chrome extension options page (MV3), plain HTML/CSS/JS, iframe + `window.postMessage` messaging.

---

## Scope check
This plan only covers Options-page focus-mode behavior (navigation highlight sync + magnetic wheel page switching). No changes to popup, background scripts, or platform content scripts.

## File structure (create/modify map)

**Create**
- `options/focusScroll/iframeScrollAgent.js` — shared wheel-edge detection + inner-scrollable guarding + `postMessage` bridge for all iframe subpages.

**Modify**
- `options/options.js` — handle `focusScrollNavigate` messages, compute next/prev (cyclic), switch page via existing `navigateToPage()`, and after iframe load send `scrollToEdge` instruction.

**Modify (each loads the shared agent)**
- `options/platform/index.html` (currently loads `platform.js` as module)
- `options/api/index.html`
- `options/storage/index.html`
- `options/menu/index.html`
- `options/notes/index.html`
- `options/ocr/index.html`
- `options/countdown/index.html`
- `options/prompts_editor/prompts_editor.html`
- `options/local_cmd/index.html`

**Note:** `options/countdown/history.html` is navigated to by parent message handler but is not in `NAV_ITEMS`. We will *not* add wheel-edge navigation there in the first iteration unless explicitly requested.

---

### Message protocol (parent <-> iframe)

**Iframe -> Parent**
- `action: "focusScrollNavigate"`
- `direction: "next" | "prev"`

**Parent -> Iframe**
- `action: "scrollToEdge"`
- `edge: "top" | "bottom"`

**Iframe -> Parent (optional, for robustness)**
- `action: "iframeReady"` (not required if we rely on iframe `load`)

---

## Task 1: Add shared iframe scroll agent (TDD + minimal behavior)

**Files:**
- Create: `options/focusScroll/iframeScrollAgent.js`
- Test: `test/options-focus-scroll-agent.test.js` (new node test)

- [ ] **Step 1: Write failing test for core helpers (inner scrollable detection)**

Create `test/options-focus-scroll-agent.test.js`:

```js
import assert from 'assert';
import {
  getScrollableAncestor,
  canScrollInDirection,
  isAtPageEdge,
} from '../options/focusScroll/iframeScrollAgent.js';

function makeScrollable({ scrollTop, scrollHeight, clientHeight }) {
  return {
    scrollTop,
    scrollHeight,
    clientHeight,
    getComputedStyle: () => ({ overflowY: 'auto' }),
  };
}

// Minimal DOM-less tests: we test pure functions with plain objects.

// canScrollInDirection
{
  const el = makeScrollable({ scrollTop: 0, scrollHeight: 200, clientHeight: 100 });
  assert.equal(canScrollInDirection(el, 'down'), true);
  assert.equal(canScrollInDirection(el, 'up'), false);
}

// isAtPageEdge
{
  const page = { scrollTop: 0, scrollHeight: 200, clientHeight: 100 };
  assert.equal(isAtPageEdge(page, 'up'), true);
  assert.equal(isAtPageEdge(page, 'down'), false);
}

console.log('✅ options focus scroll agent helper tests passed');
```

Expected: FAIL because module/functions do not exist.

- [ ] **Step 2: Run the test and confirm it fails**

Run:
```bash
node test/options-focus-scroll-agent.test.js
```
Expected: Node error `Cannot find module` or named export missing.

- [ ] **Step 3: Implement minimal agent helpers and exports**

Create `options/focusScroll/iframeScrollAgent.js` with:

```js
export function canScrollInDirection(el, direction) {
  if (!el) return false;
  const { scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = el;
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

  if (direction === 'down') return scrollTop < maxScrollTop;
  if (direction === 'up') return scrollTop > 0;
  return false;
}

export function isAtPageEdge(pageEl, direction) {
  if (!pageEl) return false;
  const { scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = pageEl;
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

  if (direction === 'down') return scrollTop >= maxScrollTop;
  if (direction === 'up') return scrollTop <= 0;
  return false;
}

export function getScrollableAncestor(target, stopEl) {
  let el = target;
  while (el && el !== stopEl && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const overflowY = style?.overflowY;
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll';

    if (isScrollable && el.scrollHeight > el.clientHeight) {
      return el;
    }

    el = el.parentElement;
  }
  return null;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run:
```bash
node test/options-focus-scroll-agent.test.js
```
Expected: prints `✅ ... passed` and exits 0.

- [ ] **Step 5: Commit**

```bash
git add options/focusScroll/iframeScrollAgent.js test/options-focus-scroll-agent.test.js
git commit -m "feat(options): add focus-mode iframe scroll agent helpers"
```

---

## Task 2: Implement wheel-edge delta accumulation + messaging in iframe agent

**Files:**
- Modify: `options/focusScroll/iframeScrollAgent.js`

- [ ] **Step 1: Extend agent with `initFocusScrollAgent()` (no-op unless focus mode)**

Add below the helper exports:

```js
const EDGE_DELTA_THRESHOLD = 120;
const EDGE_DELTA_DECAY_MS = 350;

export function initFocusScrollAgent() {
  let acc = 0;
  let lastTs = 0;

  function inFocusMode() {
    return window.parent && window.parent.document && window.parent.document.querySelector('.app-container')?.classList.contains('focus-mode');
  }

  function postNavigate(direction) {
    window.parent?.postMessage({ action: 'focusScrollNavigate', direction }, '*');
  }

  window.addEventListener('message', (e) => {
    if (e.data?.action === 'scrollToEdge') {
      const edge = e.data.edge;
      const root = document.scrollingElement || document.documentElement;
      if (edge === 'top') root.scrollTop = 0;
      if (edge === 'bottom') root.scrollTop = root.scrollHeight;
    }
  });

  window.addEventListener('wheel', (e) => {
    if (!inFocusMode()) return;

    const direction = e.deltaY > 0 ? 'down' : 'up';
    const root = document.scrollingElement || document.documentElement;

    // inner scrollable guard
    const inner = getScrollableAncestor(e.target, root);
    if (inner && canScrollInDirection(inner, direction)) {
      acc = 0;
      return;
    }

    // only accumulate when page is at edge
    if (!isAtPageEdge(root, direction)) {
      acc = 0;
      return;
    }

    const now = Date.now();
    if (now - lastTs > EDGE_DELTA_DECAY_MS) acc = 0;
    lastTs = now;

    acc += Math.abs(e.deltaY);

    if (acc >= EDGE_DELTA_THRESHOLD) {
      acc = 0;
      postNavigate(direction === 'down' ? 'next' : 'prev');
    }
  }, { passive: true });
}
```

- [ ] **Step 2: Manual sanity check for side effects**

Confirm this module still only exports functions; nothing auto-executes.

- [ ] **Step 3: Commit**

```bash
git add options/focusScroll/iframeScrollAgent.js
git commit -m "feat(options): add wheel-edge navigation messaging for focus mode"
```

---

## Task 3: Parent options shell handles focusScrollNavigate and performs cyclic navigation

**Files:**
- Modify: `options/options.js`

- [ ] **Step 1: Add message handler branch for focusScrollNavigate**

In `window.addEventListener('message', ...)` inside `initializeOptions()`, add a new branch:

```js
    } else if (event.data.action === 'focusScrollNavigate') {
      if (!isFocusMode()) return;
      const direction = event.data.direction;
      handleFocusScrollNavigate(direction);
    }
```

- [ ] **Step 2: Implement `handleFocusScrollNavigate(direction)`**

Add new functions near other helpers:

```js
function getNavIndexByPage(page) {
  const idx = NAV_ITEMS.findIndex((it) => it.page === page);
  return idx === -1 ? 0 : idx;
}

function getCyclicPageByDirection(direction) {
  const current = getCurrentPage();
  const idx = getNavIndexByPage(current);
  if (direction === 'next') {
    return NAV_ITEMS[(idx + 1) % NAV_ITEMS.length].page;
  }
  if (direction === 'prev') {
    return NAV_ITEMS[(idx - 1 + NAV_ITEMS.length) % NAV_ITEMS.length].page;
  }
  return current;
}

function handleFocusScrollNavigate(direction) {
  const target = getCyclicPageByDirection(direction);
  const edge = direction === 'next' ? 'top' : 'bottom';

  const frame = document.getElementById('content-frame');
  frame.onload = () => {
    frame.contentWindow?.postMessage({ action: 'scrollToEdge', edge }, '*');
    // restore prior onload? (we keep it simple: set back to null)
    frame.onload = null;
  };

  navigateToPage(target);
}
```

- [ ] **Step 3: Ensure navigateToPage updates dot-nav active**

This is already true (`navigateToPage()` calls `updateNavRingActive()`), so no code change unless bugs appear.

- [ ] **Step 4: Commit**

```bash
git add options/options.js
git commit -m "feat(options): parent handles focus-mode wheel navigation and scroll snapping"
```

---

## Task 4: Load the iframe agent on each Options subpage

**Files:**
- Modify: `options/platform/index.html`
- Modify: `options/api/index.html`
- Modify: `options/storage/index.html`
- Modify: `options/menu/index.html`
- Modify: `options/notes/index.html`
- Modify: `options/ocr/index.html`
- Modify: `options/countdown/index.html`
- Modify: `options/prompts_editor/prompts_editor.html`
- Modify: `options/local_cmd/index.html`

- [ ] **Step 1: For module pages (platform) import and init**

In `options/platform/index.html`, after `platform.js` module script, add another module script:

```html
<script type="module">
  import { initFocusScrollAgent } from '../focusScroll/iframeScrollAgent.js';
  initFocusScrollAgent();
</script>
```

- [ ] **Step 2: For non-module pages, convert to module and init**

Example for `options/api/index.html` (currently `<script src="api.js"></script>`). Change to:

```html
<script type="module">
  import { initFocusScrollAgent } from '../focusScroll/iframeScrollAgent.js';
  import './api.js';
  initFocusScrollAgent();
</script>
```

Repeat the same pattern per page, adjusting relative paths:
- Pages in `options/<page>/index.html`: agent path is `../focusScroll/iframeScrollAgent.js`
- Pages in `options/prompts_editor/prompts_editor.html`: agent path is `../focusScroll/iframeScrollAgent.js`
- Pages in `options/local_cmd/index.html`: agent path is `../focusScroll/iframeScrollAgent.js`

- [ ] **Step 3: Verify imported scripts do not rely on being classic scripts**

Most scripts use global `document`/`chrome` and `DOMContentLoaded`. Importing them as modules still runs them, but top-level `this` becomes undefined; ensure no code depends on `this === window`.

- [ ] **Step 4: Commit**

```bash
git add options/*/*.html options/prompts_editor/prompts_editor.html options/local_cmd/index.html
git commit -m "feat(options): load focus scroll agent in options subpages"
```

---

## Task 5: Manual verification in Chrome/Edge

**Files:** none

- [ ] **Step 1: Load extension unpacked**

Run through the repo instructions:
- Open `chrome://extensions/`
- Enable Developer mode
- Load unpacked -> select repo `ext/` (or the extension root as currently used in this repo)

- [ ] **Step 2: Open Options page and enter focus mode**

- Open extension Options
- Click focus mode button (◎)
- Confirm sidebar hides and dot-nav remains

- [ ] **Step 3: Verify dot-nav active highlight**

- Click a dot-nav item; confirm it highlights and the correct page loads.

- [ ] **Step 4: Verify wheel-edge next/prev and cyclic wrap**

On a page with enough content to scroll:
- Scroll to bottom; keep scrolling downward; expect it switches to next page and new page starts at top.
- Scroll to top; keep scrolling upward; expect it switches to previous page and new page jumps to bottom.
- At last NAV_ITEMS page, bottom + scroll down -> should wrap to first.
- At first NAV_ITEMS page, top + scroll up -> should wrap to last.

- [ ] **Step 5: Verify inner scrollable guard**

On `菜单配置` page:
- Put mouse over JSON textarea / bookmark tree.
- Scroll inside it; confirm it scrolls internally and does not switch the whole page until that inner scroller reaches its edge and you continue.

- [ ] **Step 6: Verify normal mode unaffected**

Exit focus mode; repeat wheel-edge behavior; confirm no auto page switching occurs.

- [ ] **Step 7: Commit any small fixups discovered during manual testing**

```bash
git add -A
# (stage only relevant files; avoid .idea and other noise)
git commit -m "fix(options): tune focus-mode scroll navigation edge cases"
```

---

## Plan self-review
- Spec coverage:
  - Focus-mode only: Task 2 checks focus mode; Task 3 ignores messages if not focus.
  - Cyclic wrap: Task 3 `getCyclicPageByDirection`.
  - Snap after switch: Task 3 `scrollToEdge`.
  - Inner scrollables first: Task 2 `getScrollableAncestor` + `canScrollInDirection`.
- Placeholder scan: no TBD/TODO.
- Name consistency: `focusScrollNavigate` / `scrollToEdge` used consistently.
