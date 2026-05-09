// Safe markdown rendering for sidebar (blocks raw HTML)

export function renderMarkdownSafe(markdown) {
  const text = String(markdown || "");

  if (globalThis.marked?.parse) {
    const renderer = new globalThis.marked.Renderer();
    renderer.html = () => "";

    try {
      return globalThis.marked.parse(text, {
        gfm: true,
        breaks: true,
        renderer,
        mangle: false,
        headerIds: false,
      });
    } catch {
      // fall through
    }
  }

  return escapeHtml(text).replace(/\n/g, "<br>");
}

function escapeHtml(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
