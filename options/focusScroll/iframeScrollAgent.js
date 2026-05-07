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
