---
name: options-hide-scrollbar
description: Use when options iframe subpages need hidden WebKit scrollbars while preserving scroll behavior, especially when a shared CSS file is loaded by both the outer shell and iframe pages.
---

# Options Hide Scrollbar

## Overview
Use a page-only selector so the outer options shell keeps its own layout and sidebar scrollbars unchanged. The safest anchor in this repo is `.page-container`, because the iframe subpages already use it.

## When to Use
- The options page uses an outer shell plus iframe subpages.
- Only the iframe subpages should hide their page scrollbar.
- Chrome/Edge behavior is enough; Firefox is not required.
- A shared stylesheet is loaded by both shell and subpages.

## Core Pattern
Put the rule in the shared options stylesheet, but scope it to subpages only:

```css
html:has(.page-container)::-webkit-scrollbar,
body:has(.page-container)::-webkit-scrollbar {
  width: 0;
  height: 0;
}

html:has(.page-container)::-webkit-scrollbar-track,
body:has(.page-container)::-webkit-scrollbar-track,
html:has(.page-container)::-webkit-scrollbar-thumb,
body:has(.page-container)::-webkit-scrollbar-thumb {
  background: transparent;
  opacity: 0;
}
```

This keeps the iframe pages scrollable while hiding the visible scrollbar.

## Quick Reference
- Use `:has(.page-container)` to target iframe subpages only.
- Keep the rule in `options/options.css` so every subpage inherits it.
- Do not apply the rule to the outer shell directly.
- If a subpage scrolls inside a different container, add the same pattern to that container instead.

## Common Mistakes
- Putting the rule on `.main-content` in the outer shell. That changes the wrapper, not the iframe page scrollbar.
- Scoping only `body` without a subpage-only anchor. That can leak into the shell if the stylesheet is shared.
- Hiding the scrollbar on the wrong element. The rule must match the element that actually scrolls.
- Forgetting that `width: 0` and `height: 0` are enough to hide the scrollbar visually.
