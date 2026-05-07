/**
 * Shared helpers for Options focus-mode iframe scroll agent.
 *
 * Note: This file is imported both in browser iframes and in Node tests.
 * - Browser-only globals (window/document) are only accessed inside the
 *   functions that require them (getScrollableAncestor).
 */

/**
 * Check whether an element can scroll further in a given direction.
 *
 * @param {HTMLElement|{scrollTop:number,scrollHeight:number,clientHeight:number}|null} el
 * @param {'up'|'down'} direction
 */
export function canScrollInDirection(el, direction) {
  if (!el) return false;

  const scrollTop = Number(el.scrollTop || 0);
  const scrollHeight = Number(el.scrollHeight || 0);
  const clientHeight = Number(el.clientHeight || 0);

  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

  if (direction === 'down') return scrollTop < maxScrollTop;
  if (direction === 'up') return scrollTop > 0;
  return false;
}

/**
 * Check whether the page (document.scrollingElement) is at the requested edge.
 *
 * @param {HTMLElement|{scrollTop:number,scrollHeight:number,clientHeight:number}|null} pageEl
 * @param {'up'|'down'} direction
 */
export function isAtPageEdge(pageEl, direction) {
  if (!pageEl) return false;

  const scrollTop = Number(pageEl.scrollTop || 0);
  const scrollHeight = Number(pageEl.scrollHeight || 0);
  const clientHeight = Number(pageEl.clientHeight || 0);

  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

  if (direction === 'down') return scrollTop >= maxScrollTop;
  if (direction === 'up') return scrollTop <= 0;
  return false;
}

/**
 * Find the nearest scrollable ancestor starting from target.
 *
 * Rules:
 * - Only consider elements with overflow-y: auto|scroll
 * - Only consider elements with scrollHeight > clientHeight
 * - Stop when reaching stopEl / body / documentElement
 *
 * @param {HTMLElement|null} target
 * @param {HTMLElement|null} stopEl
 * @returns {HTMLElement|null}
 */
export function getScrollableAncestor(target, stopEl) {
  // In Node tests, window/document may not exist. Caller should only use this
  // in a browser-like environment or provide mocks.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  let el = target;

  while (
    el &&
    el !== stopEl &&
    el !== document.body &&
    el !== document.documentElement
  ) {
    const style = window.getComputedStyle(el);
    const overflowY = style && style.overflowY;
    const isScrollable = overflowY === 'auto' || overflowY === 'scroll';

    if (isScrollable && el.scrollHeight > el.clientHeight) {
      return el;
    }

    el = el.parentElement;
  }

  return null;
}

const EDGE_DELTA_THRESHOLD = 120;
const EDGE_DELTA_DECAY_MS = 350;

/**
 * Init focus-mode wheel-edge navigation agent for iframe subpages.
 *
 * Does not auto-run; callers must invoke this from each iframe page.
 */
export function initFocusScrollAgent() {
  // Guard: this agent requires browser globals.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  let acc = 0;
  let lastTs = 0;

  function inFocusMode() {
    try {
      const parentDoc = window.parent && window.parent.document;
      if (!parentDoc) return false;
      const app = parentDoc.querySelector('.app-container');
      return !!app && app.classList.contains('focus-mode');
    } catch {
      return false;
    }
  }

  function postNavigate(direction) {
    try {
      window.parent?.postMessage({ action: 'focusScrollNavigate', direction }, '*');
    } catch {
      // ignore
    }
  }

  window.addEventListener('message', (e) => {
    // Only active in focus mode.
    if (!inFocusMode()) return;

    if (!e || !e.data || e.data.action !== 'scrollToEdge') return;

    const edge = e.data.edge;
    const root = document.scrollingElement || document.documentElement;
    if (!root) return;

    if (edge === 'top') {
      root.scrollTop = 0;
    } else if (edge === 'bottom') {
      root.scrollTop = root.scrollHeight;
    }
  });

  window.addEventListener(
    'wheel',
    (e) => {
      if (!inFocusMode()) return;

      // Ignore non-vertical wheel.
      if (!e || typeof e.deltaY !== 'number' || e.deltaY === 0) return;

      const direction = e.deltaY > 0 ? 'down' : 'up';
      const root = document.scrollingElement || document.documentElement;
      if (!root) return;

      // Give precedence to inner scrollables.
      const inner = getScrollableAncestor(e.target, root);
      if (inner && canScrollInDirection(inner, direction)) {
        acc = 0;
        return;
      }

      // Only accumulate when the page root is already at the edge.
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
    },
    { passive: true }
  );
}
