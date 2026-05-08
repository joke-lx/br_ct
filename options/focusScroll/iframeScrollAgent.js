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
  const EPS = 1; // tolerate fractional scrollTop / rounding

  if (direction === 'down') return scrollTop >= maxScrollTop - EPS;
  if (direction === 'up') return scrollTop <= EPS;
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

  const log = (...args) => console.log('[Options FocusScroll]', ...args);

  /** @type {string|null} */
  let parentOrigin = null;
  try {
    // Preferred: derive from referrer (parent page URL).
    if (document.referrer) {
      parentOrigin = new URL(document.referrer).origin;
    }
  } catch {
    parentOrigin = null;
  }

  // In extension iframes, referrer may be empty. Parent lives on the same extension origin.
  if (!parentOrigin) {
    try {
      parentOrigin = new URL(window.location.href).origin;
    } catch {
      parentOrigin = null;
    }
  }

  log('init', {
    href: window.location.href,
    referrer: document.referrer,
    parentOrigin,
  });

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
    if (!parentOrigin) {
      log('skip postNavigate: missing parentOrigin', direction);
      return;
    }

    log('postNavigate', { direction, parentOrigin });

    try {
      window.parent?.postMessage(
        { action: 'focusScrollNavigate', direction },
        parentOrigin
      );
    } catch (error) {
      log('postNavigate failed', error);
    }
  }

  window.addEventListener('message', (e) => {
    // Only active in focus mode.
    if (!inFocusMode()) return;

    if (!parentOrigin) return;
    if (!e || !e.data || e.data.action !== 'scrollToEdge') return;

    // Only accept messages from our direct parent and expected origin.
    if (e.source !== window.parent) return;
    if (e.origin !== parentOrigin) return;

    const edge = e.data.edge;
    const root = document.scrollingElement || document.documentElement;
    if (!root) return;

    log('scrollToEdge', {
      edge,
      before: {
        scrollTop: root.scrollTop,
        scrollHeight: root.scrollHeight,
        clientHeight: root.clientHeight,
      },
    });

    if (edge === 'top') {
      root.scrollTop = 0;
    } else if (edge === 'bottom') {
      root.scrollTop = root.scrollHeight;
    }

    log('scrollToEdge applied', {
      edge,
      after: { scrollTop: root.scrollTop },
    });
  });

  window.addEventListener(
    'wheel',
    (e) => {
      const focus = inFocusMode();
      if (!focus) return;

      if (e.defaultPrevented) {
        log('wheel ignored: defaultPrevented', {
          target: e.target && e.target.tagName,
        });
        return;
      }

      // Ignore non-vertical wheel.
      if (!e || typeof e.deltaY !== 'number' || e.deltaY === 0) return;

      const direction = e.deltaY > 0 ? 'down' : 'up';
      const root = document.scrollingElement || document.documentElement;
      if (!root) return;

      const before = {
        scrollTop: root.scrollTop,
        scrollHeight: root.scrollHeight,
        clientHeight: root.clientHeight,
      };

      log('wheel inspect', {
        direction,
        deltaY: e.deltaY,
        targetTag: e.target && e.target.tagName,
        targetClass: e.target && e.target.className,
        root: before,
      });

      // Give precedence to inner scrollables.
      const inner = getScrollableAncestor(e.target, root);
      if (inner) {
        const innerCanScroll = canScrollInDirection(inner, direction);
        if (innerCanScroll) {
          acc = 0;
          log('wheel inner-scrollable consumes', {
            direction,
            deltaY: e.deltaY,
            inner: {
              tag: inner.tagName,
              className: inner.className,
              scrollTop: inner.scrollTop,
              scrollHeight: inner.scrollHeight,
              clientHeight: inner.clientHeight,
            },
          });
          return;
        }

        // Inner is scrollable but already at its edge; allow paging from here.
        log('wheel inner-scrollable at edge', {
          direction,
          deltaY: e.deltaY,
          inner: {
            tag: inner.tagName,
            className: inner.className,
            scrollTop: inner.scrollTop,
            scrollHeight: inner.scrollHeight,
            clientHeight: inner.clientHeight,
          },
        });
      }

      const atRootEdge = isAtPageEdge(root, direction);
      log('wheel edge check', {
        direction,
        atRootEdge,
        scrollTop: before.scrollTop,
        maxScrollTop: Math.max(0, before.scrollHeight - before.clientHeight),
      });

      // If we're at the root edge (or inner edge), accumulate and maybe navigate.
      if (atRootEdge || !!inner) {
        const now = Date.now();
        if (now - lastTs > EDGE_DELTA_DECAY_MS && acc !== 0) {
          log('wheel accumulator decay reset', {
            direction,
            elapsed: now - lastTs,
            accBeforeReset: acc,
          });
          acc = 0;
        }
        lastTs = now;

        acc += Math.abs(e.deltaY);

        log('wheel edge accumulate', {
          direction,
          deltaY: e.deltaY,
          acc,
          threshold: EDGE_DELTA_THRESHOLD,
          before,
        });

        if (acc >= EDGE_DELTA_THRESHOLD) {
          acc = 0;
          log('wheel edge threshold reached', { direction, before });
          postNavigate(direction === 'down' ? 'next' : 'prev');
        }
        return;
      }

      // Not at edge yet: let the browser keep scrolling the root.
      if (acc !== 0) {
        log('wheel reset: root not at edge', {
          direction,
          deltaY: e.deltaY,
          before,
          accBeforeReset: acc,
        });
      }
    },
    { passive: true }
  );
}

