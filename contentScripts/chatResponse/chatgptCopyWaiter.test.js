import test from "node:test";
import assert from "node:assert/strict";

import { waitForValue } from "./chatgptCopyWaiter.js";

test("waitForValue resolves when value appears", async () => {
  let v = null;
  setTimeout(() => {
    v = "ok";
  }, 80);

  const got = await waitForValue(() => v, { timeoutMs: 500, intervalMs: 10 });
  assert.equal(got, "ok");
});

test("waitForValue returns null on timeout", async () => {
  const got = await waitForValue(() => null, { timeoutMs: 120, intervalMs: 20 });
  assert.equal(got, null);
});
