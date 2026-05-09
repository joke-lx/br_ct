import test from "node:test";
import assert from "node:assert/strict";

import { chooseCopyText } from "./chatgptCopyTextFallback.js";

test("chooseCopyText prefers capturedText", () => {
  assert.equal(chooseCopyText("A", "B"), "A");
});

test("chooseCopyText falls back to domText", () => {
  assert.equal(chooseCopyText("", "B"), "B");
  assert.equal(chooseCopyText(null, "B"), "B");
});

test("chooseCopyText returns null when empty", () => {
  assert.equal(chooseCopyText("", ""), null);
  assert.equal(chooseCopyText(null, null), null);
});
