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
    // for browser: window.getComputedStyle(el)
    // for tests: we just attach something that resembles style; helper uses
    // window.getComputedStyle so we don't unit-test getScrollableAncestor here.
  };
}

// canScrollInDirection
{
  const el = makeScrollable({ scrollTop: 0, scrollHeight: 200, clientHeight: 100 });
  assert.equal(canScrollInDirection(el, 'down'), true);
  assert.equal(canScrollInDirection(el, 'up'), false);
}

{
  const el = makeScrollable({ scrollTop: 100, scrollHeight: 200, clientHeight: 100 });
  assert.equal(canScrollInDirection(el, 'down'), false);
  assert.equal(canScrollInDirection(el, 'up'), true);
}

// isAtPageEdge
{
  const page = { scrollTop: 0, scrollHeight: 200, clientHeight: 100 };
  assert.equal(isAtPageEdge(page, 'up'), true);
  assert.equal(isAtPageEdge(page, 'down'), false);
}

{
  const page = { scrollTop: 100, scrollHeight: 200, clientHeight: 100 };
  assert.equal(isAtPageEdge(page, 'up'), false);
  assert.equal(isAtPageEdge(page, 'down'), true);
}

// getScrollableAncestor should be safe to call in Node (returns null).
{
  assert.equal(getScrollableAncestor(null, null), null);
}

console.log('✅ options focus scroll agent helper tests passed');
