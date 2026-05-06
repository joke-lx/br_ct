# ChatGPT Copy HTML Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture ChatGPT assistant copy actions as HTML-first clipboard events, tie them to the correct assistant turn, and forward the payload to the sidebar for inspection.

**Architecture:** Keep the existing streaming text listener for live reply updates, then add a separate clipboard capture layer that only activates around assistant-turn copy actions. The content script will use turn-scoped context plus clipboard hooks to extract `text/html` when ChatGPT provides it, while the sidebar will accept a new capture message type alongside the current streaming message type.

**Tech Stack:** Chrome Extension MV3, content scripts, `navigator.clipboard`, `DataTransfer`, `chrome.runtime.sendMessage`, existing sidebar thread renderer.

---

### File map

- `contentScripts/chatgptResponseListener.js`
  - Keep the current DOM streaming listener.
  - Add assistant-turn copy discovery, clipboard hooks, and new runtime messages for copy captures.
- `sidebar/main/mainUtils.js`
  - Handle a new `chatgptCopyCapture` message and expose a small capture preview state alongside the existing response thread.
- `sidebar/main/main.html`
  - Keep the current response container; add any minimal markup needed for the capture preview row.
- `sidebar/main/sidebar.css`
  - Style the capture preview so HTML-vs-text capture states are obvious.
- `backgroudtask/ai_platform_processor.js`
  - No behavior change expected; keep the existing injection path that already loads `contentScripts/chatgptResponseListener.js` for ChatGPT tabs.
- `contentScripts/x/copy_prenvent.js`
  - Use as a reference for clipboard-hook shape only; do not wire it into ChatGPT directly.

---

### Task 1: Add a failing capture-path test harness in the browser console

**Files:**
- Modify: `contentScripts/chatgptResponseListener.js`

- [ ] **Step 1: Add a temporary debug flag and logging branch for copy captures**

```js
const DEBUG_COPY_CAPTURE = true;
```

Add a small logging helper near the top of the file:

```js
function logCopyCapture(label, data) {
  if (!DEBUG_COPY_CAPTURE) return;
  console.log(`[ChatGPT Copy Capture] ${label}`, data);
}
```

Add a placeholder `captureClipboardPayload()` function that only logs the payload shape for now:

```js
function captureClipboardPayload(payload) {
  logCopyCapture("payload", payload);
}
```

- [ ] **Step 2: Reload the extension on a ChatGPT tab and confirm the existing stream listener still starts**

Run in the browser on a ChatGPT page after refreshing the extension.
Expected: the console still shows the existing listener startup log and no syntax errors.

- [ ] **Step 3: Trigger a manual copy action in ChatGPT and confirm the debug log path is reachable**

Expected: the new debug log prints a payload object when the clipboard hook is wired in later tasks.

- [ ] **Step 4: Commit the harness change**

```bash
git add contentScripts/chatgptResponseListener.js
git commit -m "chore: prepare chatgpt copy capture harness"
```

---

### Task 2: Detect assistant-turn copy actions

**Files:**
- Modify: `contentScripts/chatgptResponseListener.js`

- [ ] **Step 1: Add a narrow copy-context tracker around assistant turns**

Add this state near the existing listener state:

```js
let lastCopyContext = null;
const COPY_CAPTURE_WINDOW_MS = 800;
```

Add a helper that resolves the assistant turn from an event target:

```js
function getAssistantTurnFromTarget(target) {
  if (!(target instanceof Element)) return null;

  for (const selector of CONFIG.responseSelectors) {
    const turn = target.closest(selector);
    if (turn) return turn;
  }

  return null;
}
```

Add a helper that checks whether a click looks like a copy action:

```js
function isCopyLikeControl(element) {
  if (!(element instanceof Element)) return false;

  const label = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.textContent
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /copy|复制/.test(label);
}
```

Add a capture-window opener:

```js
function openCopyCaptureWindow(turnElement, sourceTarget) {
  const conversationId = getConversationId();
  const messageId = getMessageId(turnElement) || `unknown-${conversationId}`;

  lastCopyContext = {
    turnElement,
    conversationId,
    messageId,
    sourceTarget,
    openedAt: Date.now()
  };
}
```

- [ ] **Step 2: Add a document click listener in capture phase**

Add one listener in `startMonitoring()`:

```js
document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    const turn = getAssistantTurnFromTarget(target);
    if (!turn) return;
    if (!isCopyLikeControl(target) && !isCopyLikeControl(target?.closest?.("button, [role='button']"))) {
      return;
    }

    openCopyCaptureWindow(turn, target);
  },
  true
);
```

- [ ] **Step 3: Remove the capture context when it expires**

Add a helper:

```js
function getActiveCopyContext() {
  if (!lastCopyContext) return null;
  if (Date.now() - lastCopyContext.openedAt > COPY_CAPTURE_WINDOW_MS) {
    lastCopyContext = null;
    return null;
  }

  return lastCopyContext;
}
```

- [ ] **Step 4: Manually verify the click filter**

Run the page, hover or click a normal assistant message, and confirm the capture context does not open unless the click target looks like copy-related UI.
Expected: console logs only appear for copy-like clicks.

- [ ] **Step 5: Commit the copy-context change**

```bash
git add contentScripts/chatgptResponseListener.js
git commit -m "feat: detect chatgpt assistant copy actions"
```

---

### Task 3: Hook the clipboard pipeline for HTML and plain text

**Files:**
- Modify: `contentScripts/chatgptResponseListener.js`

- [ ] **Step 1: Add clipboard hook wrappers**

Add helpers that preserve originals and extract HTML-first payloads:

```js
const originalClipboardWrite = navigator.clipboard?.write?.bind(navigator.clipboard);
const originalClipboardWriteText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
const originalSetData = window.DataTransfer?.prototype?.setData;

function readClipboardItemData(item) {
  if (!item || typeof item.types === "undefined") return Promise.resolve({ html: null, text: null });

  const htmlItem = item.types?.includes("text/html") ? item.getType("text/html") : null;
  const textItem = item.types?.includes("text/plain") ? item.getType("text/plain") : null;

  return Promise.all([
    htmlItem ? htmlItem.then((blob) => blob.text()) : Promise.resolve(null),
    textItem ? textItem.then((blob) => blob.text()) : Promise.resolve(null)
  ]).then(([html, text]) => ({ html, text }));
}
```

Use a guarded override for `navigator.clipboard.write`:

```js
if (originalClipboardWrite) {
  navigator.clipboard.write = async function(items) {
    const context = getActiveCopyContext();
    if (!context) {
      return originalClipboardWrite(items);
    }

    const payload = { html: null, text: null, source: "clipboard.write" };
    for (const item of items || []) {
      const extracted = await readClipboardItemData(item);
      if (!payload.html && extracted.html) payload.html = extracted.html;
      if (!payload.text && extracted.text) payload.text = extracted.text;
    }

    captureClipboardPayload({ ...context, ...payload });
    return originalClipboardWrite(items);
  };
}
```

Add a guarded override for `navigator.clipboard.writeText`:

```js
if (originalClipboardWriteText) {
  navigator.clipboard.writeText = async function(text) {
    const context = getActiveCopyContext();
    if (context) {
      captureClipboardPayload({
        ...context,
        html: null,
        text: typeof text === "string" ? text : String(text ?? ""),
        source: "clipboard.writeText"
      });
    }

    return originalClipboardWriteText(text);
  };
}
```

Add a guarded override for `DataTransfer.prototype.setData`:

```js
if (originalSetData) {
  window.DataTransfer.prototype.setData = function(type, data) {
    const context = getActiveCopyContext();
    if (context && (type === "text/html" || type === "text/plain")) {
      captureClipboardPayload({
        ...context,
        html: type === "text/html" ? data : null,
        text: type === "text/plain" ? data : null,
        source: "dt.setData"
      });
    }

    return originalSetData.call(this, type, data);
  };
}
```

- [ ] **Step 2: Make the capture result explicit when HTML is missing**

Add a normalizer:

```js
function normalizeCopyCapture(payload) {
  return {
    platform: "chatgpt",
    conversationId: payload.conversationId,
    messageId: payload.messageId,
    html: payload.html || null,
    text: payload.text || null,
    htmlMissing: !payload.html,
    source: payload.source,
    timestamp: Date.now()
  };
}
```

Then keep `captureClipboardPayload()` as the gate that logs and forwards this normalized object.

- [ ] **Step 3: Run the page and confirm HTML is captured when present**

Expected: clicking a ChatGPT copy control emits a payload with `source` plus either `html` or `text`, and the console shows `htmlMissing: false` when HTML is available.

- [ ] **Step 4: Run the page and confirm plain-text-only captures are still recorded**

Expected: if ChatGPT writes only plain text, the payload still appears and `htmlMissing` is `true`.

- [ ] **Step 5: Commit the clipboard hook change**

```bash
git add contentScripts/chatgptResponseListener.js
git commit -m "feat: capture chatgpt clipboard html payloads"
```

---

### Task 4: Forward copy captures to the sidebar

**Files:**
- Modify: `contentScripts/chatgptResponseListener.js`
- Modify: `sidebar/main/mainUtils.js`

- [ ] **Step 1: Add a new runtime message for copy captures**

In the content script, replace the debug-only `captureClipboardPayload()` body with:

```js
function captureClipboardPayload(payload) {
  const normalized = normalizeCopyCapture(payload);
  logCopyCapture("normalized", normalized);

  chrome.runtime.sendMessage({
    action: "chatgptCopyCapture",
    data: normalized
  }).catch((err) => {
    if (!String(err?.message || "").includes("Receiving end does not exist")) {
      console.error("发送 ChatGPT copy capture 失败:", err);
    }
  });
}
```

- [ ] **Step 2: Add a handler in the sidebar message listener**

In `initializeChatGPTResponse()` add a second branch next to `chatgptResponse`:

```js
if (request.action === "chatgptCopyCapture") {
  console.log("[Sidebar] chatgptCopyCapture received", request.data);
  handleChatGPTCopyCapture(request.data);
}
```

Add a local state holder near the existing ChatGPT state:

```js
let lastCopyCapture = null;
```

Add the handler:

```js
function handleChatGPTCopyCapture(data) {
  lastCopyCapture = data || null;
  if (!responseContainer) return;
  responseContainer.style.display = "flex";
  showTempMessage(data?.htmlMissing ? "已捕获复制内容（缺少 HTML）" : "已捕获复制内容");
}
```

- [ ] **Step 3: Extend the response copy button to include the last HTML capture when present**

Update `copyResponseContent()` so the container copy button prefers the latest captured HTML if available, then falls back to the concatenated thread text:

```js
const copyValue = lastCopyCapture?.html || allText;
await navigator.clipboard.writeText(copyValue);
```

Keep the existing toast feedback.

- [ ] **Step 4: Verify the sidebar still renders the live thread**

Expected: live assistant streaming still works, and the copy capture just adds a second status path instead of replacing the thread renderer.

- [ ] **Step 5: Commit the sidebar wiring**

```bash
git add contentScripts/chatgptResponseListener.js sidebar/main/mainUtils.js
git commit -m "feat: surface chatgpt copy captures in sidebar"
```

---

### Task 5: Add a lightweight capture preview and styling

**Files:**
- Modify: `sidebar/main/main.html`
- Modify: `sidebar/main/sidebar.css`
- Modify: `sidebar/main/mainUtils.js`

- [ ] **Step 1: Add a compact capture preview line inside the response container**

Insert this markup under `.response-status` and above `.response-content`:

```html
<div class="response-capture" id="response-capture" style="display: none;">
  <span class="response-capture-label">Copy</span>
  <span class="response-capture-value" id="response-capture-value"></span>
</div>
```

- [ ] **Step 2: Add CSS for HTML vs text capture state**

Add a minimal style block:

```css
.response-capture {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  margin: 6px 0;
  border-radius: 8px;
  background: #eef4ff;
  border: 1px solid #cddfff;
  font-size: 12px;
}

.response-capture-label {
  font-weight: 600;
  color: #3156c8;
}

.response-capture-value {
  color: #374151;
  word-break: break-all;
}

.response-capture--missing-html {
  background: #fff4e5;
  border-color: #ffd59a;
}
```

- [ ] **Step 3: Wire the preview DOM nodes in `initializeChatGPTResponse()`**

Add:

```js
let responseCapture;
let responseCaptureValue;
```

Then resolve them from the DOM and update `handleChatGPTCopyCapture()`:

```js
responseCapture = document.getElementById("response-capture");
responseCaptureValue = document.getElementById("response-capture-value");

if (responseCapture && responseCaptureValue) {
  responseCapture.style.display = "flex";
  responseCapture.classList.toggle("response-capture--missing-html", !!data?.htmlMissing);
  responseCaptureValue.textContent = data?.htmlMissing ? "HTML missing" : "HTML captured";
}
```

- [ ] **Step 4: Verify the capture preview is readable and does not disturb the thread layout**

Expected: the preview line appears only when a copy is captured and visually distinguishes HTML-missing cases.

- [ ] **Step 5: Commit the UI polish**

```bash
git add sidebar/main/main.html sidebar/main/sidebar.css sidebar/main/mainUtils.js
git commit -m "feat: add chatgpt copy capture preview"
```

---

### Task 6: Verify the full flow in the browser

**Files:**
- No code changes expected

- [ ] **Step 1: Reload the extension and open a ChatGPT conversation**

Expected: no console errors from `chatgptResponseListener.js` or the sidebar.

- [ ] **Step 2: Click a ChatGPT assistant copy control after using the DOM-discovery shortcut to identify the button and turn path**

Expected: the console logs a `chatgptCopyCapture` event and the sidebar preview updates.

- [ ] **Step 3: Confirm the payload shape in the sidebar console**

Expected fields: `conversationId`, `messageId`, `html`, `text`, `htmlMissing`, `source`, `timestamp`.

- [ ] **Step 4: Confirm the normal streaming thread still updates as replies arrive**

Expected: the existing `chatgptResponse` path still renders live content and completion state.

- [ ] **Step 5: Commit the verification-only follow-up if any behavior needed a tiny fix**

```bash
git add contentScripts/chatgptResponseListener.js sidebar/main/mainUtils.js sidebar/main/main.html sidebar/main/sidebar.css
git commit -m "fix: harden chatgpt copy capture flow"
```

---

### Self-review checklist

- The spec requirement to use the DOM-discovery shortcut for fast selector calibration is covered by the copy-button discovery work and the browser verification step.
- The requirement to prefer HTML but keep plain text when HTML is absent is covered by Task 3 and Task 4.
- The requirement to keep the existing streaming reply flow intact is covered by Tasks 1, 4, and 6.
- The sidebar copy button now prefers the latest HTML capture when available, which keeps the new capture path useful without breaking the existing thread copy behavior.

No unresolved placeholders remain in the plan.
