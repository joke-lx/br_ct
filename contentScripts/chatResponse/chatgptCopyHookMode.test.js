import test from "node:test";
import assert from "node:assert/strict";

import { shouldInterceptCopyEvent } from "./chatgptCopyHookMode.js";

test("shouldInterceptCopyEvent only intercepts while context active", () => {
  const now = 10000;
  const ctx = { openedAt: now - 200, windowMs: 2500 };
  assert.equal(shouldInterceptCopyEvent(ctx, now), true);
  assert.equal(shouldInterceptCopyEvent({ openedAt: now - 2600, windowMs: 2500 }, now), false);
  assert.equal(shouldInterceptCopyEvent(null, now), false);
});
