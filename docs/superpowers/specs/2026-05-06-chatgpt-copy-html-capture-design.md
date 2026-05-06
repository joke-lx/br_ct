# ChatGPT Copy HTML Capture Design

## Goal
Capture the HTML payload that ChatGPT writes during assistant copy actions, associate it with the correct assistant turn, and forward it to the sidebar for inspection and downstream rendering.

## Context
The current `contentScripts/chatgptResponseListener.js` already tracks assistant turns with `responseSelectors` and reads streaming text from the DOM. That is useful for live text previews, but it cannot recover the richer HTML that ChatGPT may place on the clipboard when the user clicks a copy button. The requested workflow also depends on the existing DOM-discovery shortcut that can copy four selector paths plus full HTML, so selector calibration can stay fast while the copy capture path is hardened.

A direct `copy`-event reader is not enough on its own, because many pages write clipboard data through `navigator.clipboard.write(...)`, `navigator.clipboard.writeText(...)`, or `DataTransfer.setData(...)` in different combinations. The design therefore treats clipboard interception as the primary source of truth and uses turn-scoped context only to decide whether a clipboard write belongs to the assistant message the user just copied.

## Scope
### In scope
- Associate assistant copy actions with the correct ChatGPT turn using existing assistant turn selectors.
- Capture clipboard `text/html` when ChatGPT provides it.
- Capture clipboard `text/plain` as a fallback and mark whether HTML was missing.
- Forward captured results to the existing sidebar messaging path.
- Add ChatGPT-specific copy-button discovery helpers if the page exposes a stable button selector.

### Out of scope
- Reconstructing HTML from scratch when the page did not write any HTML.
- Persisting captured copy payloads across reloads.
- Changing the live streaming text extractor beyond what is needed to keep the copy capture contextual.

## Proposed architecture

### 1. Turn context layer
Keep the current assistant turn selectors as the primary way to anchor copy capture to a message:
- `[data-testid^="conversation-turn-"][data-message-author-role="assistant"]`
- `[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]`
- `[data-message-author-role="assistant"]`

When a user clicks inside a turn, record a short-lived context object:
- `conversationId`
- `messageId`
- `turnElement`
- `timestamp`

That context expires after a short capture window (for example 800 ms). Only clipboard writes that happen inside the window are considered part of the just-clicked copy action.

### 2. Clipboard interception layer
Install a small hook bundle that wraps the clipboard pipeline methods that can carry HTML:
- `navigator.clipboard.write(items)`
- `navigator.clipboard.writeText(text)`
- `DataTransfer.prototype.setData(type, data)`

Each hook does the same thing:
- Check whether a recent assistant-turn copy context exists.
- If not, delegate immediately to the original implementation.
- If yes, inspect the clipboard payload and extract `text/html` first, then `text/plain`.
- Record a capture event with a `source` field that identifies which hook observed the payload.

The hook should be narrow and stateful. It should not try to become a global clipboard logger for the whole page.

### 3. Copy-button discovery layer
ChatGPT does not expose a stable copy-button contract in the current adapter. Add a small helper that finds likely copy buttons inside the assistant turn using label-based matching, not hard-coded visual structure. The helper should prefer:
- `aria-label`
- `title`
- visible text content

This is only used to decide when to open the short-lived capture window. The clipboard hook remains responsible for extracting the actual content.

### 4. Event payload layer
Send a new runtime message to the sidebar when a capture succeeds or when HTML was expected but missing. Suggested payload shape:

```js
{
  action: "chatgptCopyCapture",
  data: {
    platform: "chatgpt",
    conversationId,
    messageId,
    html,
    text,
    htmlMissing,
    source,
    timestamp
  }
}
```

The sidebar can then decide whether to render the HTML, keep a text preview, or show a diagnostic state.

## Design details

### Capture precedence
1. Prefer `text/html` from `navigator.clipboard.write(...)` or `DataTransfer.setData("text/html", ...)`.
2. If HTML is absent, keep the plain text and set `htmlMissing: true`.
3. Do not synthesize HTML from DOM when the copy pipeline did not provide it.

### Association rules
A clipboard payload is considered part of an assistant message only when all of the following are true:
- the click target is inside an assistant turn,
- the click target looks like a copy action or is inside a copy-related control,
- the clipboard write occurs within the capture window,
- the resolved assistant turn still exists.

### Error handling
- If clipboard interception is unavailable because the browser blocks a method override, the content script should continue functioning for normal text streaming.
- If a copy action occurs but no HTML is found, emit a diagnostic event rather than failing silently.
- If a selector becomes stale, fall back to the broader assistant turn selector chain before giving up.

### Compatibility note
The repository already has a separate DOM-discovery workflow that can copy multiple selector paths and full HTML for element debugging. This design assumes that workflow remains available and is used to tune any ChatGPT-specific copy-button selectors when the UI changes.

## Testing checklist
- Click an assistant copy button and confirm a `chatgptCopyCapture` message is emitted.
- Confirm a copy that includes HTML produces a non-empty `html` field.
- Confirm a copy that only writes plain text sets `htmlMissing: true`.
- Confirm clicks outside assistant turns do not produce capture events.
- Confirm the live streaming text path still works when clipboard hooks are installed.

## Open question resolved by this design
ChatGPT does not currently have a known stable copy-button selector in this codebase, so the design explicitly separates button discovery from clipboard capture. That keeps selector tuning local and prevents the clipboard layer from depending on a brittle button shape.
