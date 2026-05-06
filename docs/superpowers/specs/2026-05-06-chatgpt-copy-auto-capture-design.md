# ChatGPT Copy Auto-Capture (On Complete) Design

## Goal
When a ChatGPT assistant message finishes rendering (generation complete), automatically obtain the same rich content the built-in "复制回复" button would provide (HTML/Markdown-like payload), and render it in the extension sidebar.

## Constraints / Reality check
- Many browsers gate clipboard write operations behind a user gesture. Programmatically clicking the copy button after generation may be blocked or may not execute the underlying clipboard write pipeline.
- Therefore, the system must be **best-effort** for "copy-button export" and must include a **DOM HTML fallback** so the sidebar still shows a complete formatted result even when clipboard export cannot be captured.

## Scope
### In scope
- On assistant completion, locate the corresponding turn and attempt an automatic "copy reply" action.
- Capture payload via the existing clipboard interception hooks (`clipboard.write`, `clipboard.writeText`, `DataTransfer.setData`).
- If no capture arrives within a short window, fall back to DOM-derived HTML (`innerHTML`) from the message content root.
- Render the captured result in the sidebar (HTML-first), without requiring manual user clicks.

### Out of scope
- Perfect byte-for-byte equivalence with ChatGPT export in all cases.
- Persisting captured results to storage.

## Architecture

### Components
1) **Completion detector** (content script)
- Lives in `contentScripts/chatgptResponseListener.js`.
- Uses existing generation detection (`isGenerating()`) and messageId tracking.
- Detects transition: `(messageId) generating -> complete`.

2) **Auto-copy executor** (content script)
- Finds the copy button inside the completed turn:
  - `button[data-testid="copy-turn-action-button"]` (preferred)
  - fallback: `button[aria-label*="复制回复"]` / `button[aria-label*="copy"]`
- Opens a short capture context window (`openCopyCaptureWindow(turn, button)`) and clicks the button.

3) **Clipboard capture layer** (content script)
- Already implemented hooks (HTML-first):
  - `navigator.clipboard.write(items)`
  - `navigator.clipboard.writeText(text)`
  - `DataTransfer.prototype.setData(type, data)`
- Produces normalized event:

```js
{
  platform: "chatgpt",
  conversationId,
  messageId,
  html,
  text,
  htmlMissing,
  source,
  timestamp
}
```

4) **DOM HTML fallback** (content script)
- If no clipboard capture occurs within the capture window, derive HTML from the message content root:
  - `turn.querySelector('[data-message-content]') || turn.querySelector('.markdown') || turn.querySelector('.prose') || turn`
  - send `{ html: contentRoot.innerHTML, source: "dom.html", htmlMissing: false }`

5) **Sidebar renderer**
- Sidebar listens for a new message type (or reuses existing `chatgptCopyCapture`) and renders HTML in a dedicated container.
- The existing preview row can display capture status (clipboard vs fallback).

## Data flow
1. MutationObserver detects updates.
2. When a message becomes complete, content script attempts auto-copy.
3. Clipboard hooks capture (preferred) OR fallback derives DOM HTML.
4. Content script sends `chatgptCopyCapture` to sidebar.
5. Sidebar renders HTML.

## Verification checklist
- A completed assistant message triggers exactly one auto-copy attempt.
- If clipboard export works, sidebar shows the captured HTML.
- If clipboard export is blocked, sidebar still shows formatted content via DOM fallback.
- Streaming text thread behavior remains unchanged.
