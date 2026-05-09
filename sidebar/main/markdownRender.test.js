import test from "node:test";
import assert from "node:assert/strict";

import { renderMarkdownSafe } from "./markdownRender.js";

test("renderMarkdownSafe renders markdown basics", () => {
  globalThis.marked = {
    Renderer: class Renderer {
      html() {
        return "";
      }
    },
    parse(md) {
      // Minimal fake parser for test: emulate a couple of transforms.
      return String(md)
        .replace(/^# (.*)$/gm, "<h1>$1</h1>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    },
  };

  const html = renderMarkdownSafe("# Title\n\n**bold**");
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
});

test("renderMarkdownSafe blocks raw HTML", () => {
  globalThis.marked = {
    Renderer: class Renderer {
      html() {
        return "";
      }
    },
    parse(md, opts) {
      // Simulate marked calling renderer.html for HTML blocks.
      const r = opts?.renderer;
      return r?.html("<img src=x onerror=alert(1)>") || "";
    },
  };

  const html = renderMarkdownSafe("<img src=x onerror=alert(1)>");
  assert.equal(html, "");
});

test("renderMarkdownSafe falls back to escaped HTML when marked missing", () => {
  delete globalThis.marked;

  const html = renderMarkdownSafe("<script>alert(1)</script>\nline2");
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;<br>line2/);
});
