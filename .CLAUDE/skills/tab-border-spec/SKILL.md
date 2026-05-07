---
name: tab-border-spec
description: Options sidebar nav-item and icon styling convention. Border emphasis on icon squares, not color blocks. Hover/active state rules for the extension's warm paper theme.
---

# Tab Nav Border Specification

## Triggering Conditions

- Modifying `.nav-item` or `.nav-icon` styles in `options/options.css`
- Building new sidebar nav items in options pages
- Adjusting hover/active/focus states for navigation elements
- User mentions "边框", "色块", "方块强调", "tab样式"

## Core Rules

### 1. Icon Square Uses Border, Not Background Fill

The `.nav-icon` (letter abbreviation square) uses `border` for visual emphasis. No opaque background color fill on the icon itself.

```css
.nav-icon {
  border: 1px solid var(--line);        /* default: subtle border */
  background: transparent;
  color: var(--ink);                    /* full opacity, never semi-transparent */
  font-size: 11px;
  font-weight: 800;
}

/* Hover: slightly stronger border + light fill */
.nav-item:hover .nav-icon {
  border-color: var(--line-strong);
  background: rgba(255, 255, 255, 0.5);
}

/* Active: accent color border = selected indicator */
.nav-item.active .nav-icon {
  border-color: var(--accent);
}
```

### 2. Nav Item States

```css
/* Default: no background, full ink color */
.nav-item {
  border: none;
  background: transparent;
  color: var(--ink);           /* #2d241c, ALWAYS full opacity */
}

/* Hover: white color block rises */
.nav-item:hover {
  background: rgba(255, 255, 255, 0.7);
}

/* Active: stronger white color block + icon accent border */
.nav-item.active {
  background: rgba(255, 255, 255, 0.85);
}
```

### 3. Text Color Rule

**Text must use `var(--ink)` (`#2d241c`) at full opacity.** Never use `rgba(45, 36, 28, 0.6)` or similar for nav text - it appears too light on the warm paper background.

## State Summary

| State | .nav-item background | .nav-item text | .nav-icon border | .nav-icon background |
|-------|---------------------|----------------|------------------|---------------------|
| Default | transparent | `var(--ink)` | `var(--line)` | transparent |
| Hover | `rgba(255,255,255,0.7)` | `var(--ink)` | `var(--line-strong)` | `rgba(255,255,255,0.5)` |
| Active | `rgba(255,255,255,0.85)` | `var(--ink)` | `var(--accent)` | transparent |

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Border on `.nav-item` instead of `.nav-icon` | Entire row outlined, looks wrong | Only `.nav-icon` gets border emphasis |
| Text color `rgba(45,36,28,0.6~0.8)` | Text appears washed out on warm bg | Use `var(--ink)` full opacity |
| Background fill on `.nav-icon` default state | Looks like a colored button | Default is transparent, only hover adds light fill |
| No background on `.nav-item.active` | Active tab not distinguishable | Active must have white color block |
| Removing active background entirely | User can't tell which tab is selected | Active always needs `rgba(255,255,255,0.85)` |

## Correct Iteration History

1. First: border on `.nav-item` row -> WRONG, user wanted icon-only border
2. Then: removed all backgrounds -> WRONG, user wanted hover/active color blocks back
3. Then: text color 0.68 -> too light -> 0.8 -> still light -> 0.92 -> still light -> `var(--ink)` CORRECT
4. Then: no active background -> WRONG, added `rgba(255,255,255,0.85)` back
5. Final: icon border emphasis + nav-item hover/active color blocks + full ink text

## Priority

| Priority | Rule | Why |
|----------|-------|-----|
| P0 | Text color = `var(--ink)` full opacity | Semi-transparent text invisible on warm bg |
| P1 | Border on `.nav-icon` only, not `.nav-item` | Visual emphasis targets the icon square |
| P2 | Active state must have background color block | Users need clear selected indicator |
