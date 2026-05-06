# ChatGPT Sidebar Thread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the sidebar (under "📄 提取页面文本"), show a ChatGPT assistant reply history thread that updates in real-time while ChatGPT is generating.

**Architecture:** A dedicated content script (`contentScripts/chatgptResponseListener.js`) observes ChatGPT DOM mutations, derives `(conversationId, messageId)`, and sends `chrome.runtime.sendMessage({ action: "chatgptResponse", data })`. The sidebar (`sidebar/main/mainUtils.js`) maintains an in-memory per-conversation message list and renders it as an enhanced timeline thread (方案2). Auto-scroll only when the user is already near the bottom.

**Tech Stack:** Chrome Extension MV3, content scripts, `chrome.runtime.sendMessage`, DOM `MutationObserver`, sidebar HTML/CSS/JS.

---

## Scope / Non-goals

- In-scope: multi-message assistant history in sidebar; per-message copy + collapse; container copy = all assistant messages concatenated.
- Not in-scope: persisting history across sidebar reloads (no `chrome.storage`), cross-tab conversation switching UI, markdown rendering (keep plain text).

---

## Files to modify / create

### Modify
- `contentScripts/chatgptResponseListener.js`
  - Responsibility: Observe ChatGPT page, extract assistant reply text per message, emit events to sidebar.
- `sidebar/main/main.html`
  - Responsibility: Keep existing ChatGPT response container; adjust `#response-content` initial markup if needed.
- `sidebar/main/sidebar.css`
  - Responsibility: Add/adjust CSS for enhanced thread (方案2) message cards.
- `sidebar/main/mainUtils.js`
  - Responsibility: Replace single-string streaming renderer with per-message list renderer + auto-scroll rules + copy/collapse controls.

### Optional (only if needed for injection wiring)
- `backgroudtask/ai_platform_processor.js`
  - If we decide to inject the listener from background for ChatGPT tabs explicitly.

---

## Message contract

Content script sends:

```js
chrome.runtime.sendMessage({
  action: "chatgptResponse",
  data: {
    platform: "chatgpt",
    conversationId,
    messageId,
    role: "assistant",
    content,
    isComplete,
    timestamp: Date.now()
  }
});
```

Notes:
- `content` is the full current text for that messageId.
- Sidebar treats `(conversationId, messageId)` as the stable key.

---

## Task 1: Add enhanced thread CSS (方案2)

**Files:**
- Modify: `sidebar/main/sidebar.css`

- [ ] **Step 1: Add CSS for `.chatgpt-thread--enhanced`**

Add these blocks (keep variable usage consistent with existing `sidebar.css`):

```css
.chatgpt-thread {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chatgpt-thread--enhanced {
  position: relative;
  padding-left: 10px;
}

.chatgpt-thread--enhanced::before {
  content: "";
  position: absolute;
  left: 4px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e2e8f0;
  border-radius: 2px;
}

.chatgpt-msg {
  background: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
}

.chatgpt-thread--enhanced .chatgpt-msg::before {
  content: "";
  position: absolute;
  left: -10px;
  top: 10px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #cbd5e0;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px var(--border-color);
}

.chatgpt-thread--enhanced .chatgpt-msg[data-state="generating"]::before {
  background: #48bb78;
}

.chatgpt-thread--enhanced .chatgpt-msg[data-state="completed"]::before {
  background: var(--primary-color);
}

.chatgpt-msg-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #f8fafc;
  border-bottom: 1px solid var(--border-color);
  font-size: 11px;
}

.chatgpt-msg-title {
  font-weight: 600;
  color: var(--text-color);
}

.chatgpt-msg-time {
  margin-left: auto;
  color: #718096;
  font-variant-numeric: tabular-nums;
}

.chatgpt-msg-actions button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  color: #718096;
  border-radius: 4px;
  line-height: 1;
}

.chatgpt-msg-actions button:hover {
  background-color: #f0f4ff;
  color: var(--primary-color);
}

.chatgpt-msg-body {
  margin: 0;
  padding: 8px 10px;
  background: #f7fafc;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.6;
  max-height: 180px;
  overflow: auto;
}

.chatgpt-msg[data-collapsed="true"] .chatgpt-msg-body {
  max-height: 0;
  padding: 0 10px;
  overflow: hidden;
}

.chatgpt-thread--enhanced .chatgpt-msg[data-state="generating"] .chatgpt-msg-head {
  position: relative;
}

.chatgpt-thread--enhanced .chatgpt-msg[data-state="generating"] .chatgpt-msg-head::after {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  height: 2px;
  width: 100%;
  background: linear-gradient(90deg, #48bb78, #4cc9f0);
  opacity: 0.7;
  animation: pulse 1.2s infinite;
}
```

- [ ] **Step 2: Manual UI check**

Open the sidebar and verify the thread styles render without breaking existing `.chatgpt-response-container` layout.

- [ ] **Step 3: Commit**

```bash
git add sidebar/main/sidebar.css
git commit -m "feat(sidebar): add enhanced chatgpt thread styles"
```

---

## Task 2: Render a message list in the sidebar

**Files:**
- Modify: `sidebar/main/mainUtils.js`

### State + helpers

- [ ] **Step 1: Add in-memory thread state**

Near the existing ChatGPT reply vars (`mainUtils.js` around the ChatGPT section), replace single-string-only state with:

```js
let activeConversationId = "__default__";
let threadMessages = []; // Array<{ messageId, content, isComplete, timestamp }>
const threadMessageIndex = new Map(); // messageId -> index
```

- [ ] **Step 2: Add DOM helpers**

Add these helper functions:

```js
function ensureThreadRoot() {
  if (!responseContent) return null;
  let root = responseContent.querySelector("#chatgpt-thread");
  if (!root) {
    responseContent.innerHTML = "";
    root = document.createElement("div");
    root.id = "chatgpt-thread";
    root.className = "chatgpt-thread chatgpt-thread--enhanced";
    responseContent.appendChild(root);
  }
  return root;
}

function formatTime(ts) {
  const d = new Date(ts || Date.now());
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isNearBottom(el, thresholdPx = 40) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}
```

### Render/update per message

- [ ] **Step 3: Add render/update function**

```js
function upsertThreadMessage({ conversationId, messageId, content, isComplete, timestamp }) {
  if (!messageId) return;

  // Switch active conversation automatically for now
  activeConversationId = conversationId || "__default__";

  const existingIndex = threadMessageIndex.get(messageId);
  if (existingIndex == null) {
    threadMessageIndex.set(messageId, threadMessages.length);
    threadMessages.push({ messageId, content, isComplete: !!isComplete, timestamp: timestamp || Date.now() });
    renderThreadMessage(threadMessages.length - 1);
  } else {
    const msg = threadMessages[existingIndex];
    msg.content = content;
    msg.isComplete = !!isComplete;
    msg.timestamp = timestamp || msg.timestamp;
    patchThreadMessage(existingIndex);
  }
}

function renderThreadMessage(index) {
  const root = ensureThreadRoot();
  if (!root) return;

  const msg = threadMessages[index];
  const el = document.createElement("div");
  el.className = "chatgpt-msg";
  el.dataset.messageId = msg.messageId;
  el.dataset.state = msg.isComplete ? "completed" : "generating";
  el.dataset.collapsed = "false";

  el.innerHTML = `
    <div class="chatgpt-msg-head">
      <span class="chatgpt-msg-title">Assistant #${index + 1}</span>
      <span class="chatgpt-msg-time">${formatTime(msg.timestamp)}</span>
      <div class="chatgpt-msg-actions">
        <button class="chatgpt-msg-copy" title="复制本条">📋</button>
        <button class="chatgpt-msg-toggle" title="折叠/展开">▾</button>
      </div>
    </div>
    <pre class="chatgpt-msg-body"></pre>
  `;

  el.querySelector(".chatgpt-msg-body").textContent = msg.content || "";

  el.querySelector(".chatgpt-msg-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(msg.content || "");
      showTempMessage("已复制本条");
    } catch {
      showTempMessage("复制失败");
    }
  });

  el.querySelector(".chatgpt-msg-toggle").addEventListener("click", () => {
    const collapsed = el.dataset.collapsed === "true";
    el.dataset.collapsed = collapsed ? "false" : "true";
    el.querySelector(".chatgpt-msg-toggle").textContent = collapsed ? "▾" : "▸";
  });

  root.appendChild(el);
  maybeAutoScroll();
}

function patchThreadMessage(index) {
  const root = ensureThreadRoot();
  if (!root) return;

  const msg = threadMessages[index];
  const el = root.querySelector(`.chatgpt-msg[data-message-id="${CSS.escape(msg.messageId)}"]`);
  if (!el) return;

  el.dataset.state = msg.isComplete ? "completed" : "generating";
  const body = el.querySelector(".chatgpt-msg-body");
  const wasNearBottom = isNearBottom(body);
  body.textContent = msg.content || "";
  if (wasNearBottom) body.scrollTop = body.scrollHeight;

  const timeEl = el.querySelector(".chatgpt-msg-time");
  if (timeEl) timeEl.textContent = formatTime(msg.timestamp);

  maybeAutoScroll();
}

function maybeAutoScroll() {
  if (!responseContent) return;
  const root = responseContent;
  if (isNearBottom(root)) {
    root.scrollTop = root.scrollHeight;
  }
}
```

- [ ] **Step 4: Update `handleChatGPTResponse` to call upsert**

Change `handleChatGPTResponse(data)` to:

```js
function handleChatGPTResponse(data) {
  const { content, messageId, isComplete, timestamp, conversationId } = data;

  if (responseContainer) responseContainer.style.display = "flex";

  updateResponseStatus(isComplete);

  upsertThreadMessage({
    conversationId: conversationId || "__default__",
    messageId: messageId || `unknown-${Date.now()}`,
    content,
    isComplete,
    timestamp
  });
}
```

- [ ] **Step 5: Container-level copy = copy all**

Update `copyResponseContent()` to concatenate all messages:

```js
const allText = threadMessages.map((m, i) => `Assistant #${i + 1}\n${m.content || ""}`).join("\n\n");
await navigator.clipboard.writeText(allText);
```

- [ ] **Step 6: Reset clears thread**

In `resetResponseDisplay()` and `closeResponseContainer()`, also reset:

```js
threadMessages = [];
threadMessageIndex.clear();
activeConversationId = "__default__";
```

- [ ] **Step 7: Run manual test**

Open sidebar, simulate a few `chatgptResponse` messages in DevTools console (sidebar context):

```js
chrome.runtime.sendMessage({
  action: "chatgptResponse",
  data: { conversationId: "c1", messageId: "m1", content: "Hello", isComplete: false, timestamp: Date.now() }
});
chrome.runtime.sendMessage({
  action: "chatgptResponse",
  data: { conversationId: "c1", messageId: "m1", content: "Hello world", isComplete: true, timestamp: Date.now() }
});
chrome.runtime.sendMessage({
  action: "chatgptResponse",
  data: { conversationId: "c1", messageId: "m2", content: "Second msg", isComplete: true, timestamp: Date.now() }
});
```

Expected:
- 两条卡片追加
- m1 卡片从 generating -> completed

- [ ] **Step 8: Commit**

```bash
git add sidebar/main/mainUtils.js
git commit -m "feat(sidebar): render chatgpt assistant thread"
```

---

## Task 3: Wire the ChatGPT content listener into the injection path

**Goal:** Ensure `contentScripts/chatgptResponseListener.js` actually runs on ChatGPT pages.

We will use **background injection** (recommended here) because the project already injects `contentScripts/{platform}.js` via `ai_platform_processor.js`. This avoids manifest-wide injection and keeps scope tight.

**Files:**
- Modify: `backgroudtask/ai_platform_processor.js`

- [ ] **Step 1: Inject listener after platform script injection**

In `injectAndExecuteScript(tabId, platform, ...)` after injecting `contentScripts/${platform}.js`, also inject `contentScripts/chatgptResponseListener.js` when `platform === "chatgpt"`.

Pseudo-change:

```js
const files = [scriptFile];
if (platform === "chatgpt") files.push("contentScripts/chatgptResponseListener.js");
chrome.scripting.executeScript({ target: { tabId }, files }, () => { ... })
```

- [ ] **Step 2: Manual test**

1) Load extension unpacked.
2) Send a message to ChatGPT via the extension.
3) Watch sidebar thread update as ChatGPT responds.

- [ ] **Step 3: Commit**

```bash
git add backgroudtask/ai_platform_processor.js
git commit -m "feat(chatgpt): inject response listener with chatgpt script"
```

---

## Task 4: Fix and harden `chatgptResponseListener.js`

**Files:**
- Modify: `contentScripts/chatgptResponseListener.js`

- [ ] **Step 1: Remove ES module exports**

Delete the `export { ... }` block at the bottom.

- [ ] **Step 2: Add conversationId extraction**

Add:

```js
function getConversationId() {
  try {
    const url = new URL(location.href);
    // ChatGPT commonly uses /c/<id> or /chat/<id> patterns; keep it defensive.
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("c");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    if (parts[0] === "chat" && parts[1]) return parts[1];
  } catch {}
  return "__default__";
}
```

- [ ] **Step 3: Include conversationId in send payload**

Update `sendResponseToSidebar` to attach `conversationId: getConversationId()`.

- [ ] **Step 4: Make `isGenerating()` more robust**

Replace current stop-button selector approach with label scan similar to openteam adapter style:

```js
function isGenerating() {
  return Array.from(document.querySelectorAll("button")).some((btn) => {
    const label = [btn.getAttribute("aria-label"), btn.getAttribute("title"), btn.textContent]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return /stop|stopping|停止|中止/.test(label) && !btn.disabled && btn.getAttribute("aria-disabled") !== "true";
  });
}
```

- [ ] **Step 5: Fix delayed call leak**

In `startMonitoring()`, store the timeout handle and clear it in `stopMonitoring()`.

- [ ] **Step 6: Tighten selectors to assistant turns**

Ensure `getLatestResponseContainer()` returns the *turn container* (the element with `data-testid^="conversation-turn-"` and `data-message-author-role="assistant"`) rather than `.markdown.prose` nodes.

Implementation: remove `.markdown.prose` from `CONFIG.responseSelectors` and keep only assistant turn selectors.

- [ ] **Step 7: Manual test on chatgpt.com**

Open chatgpt.com, open DevTools console, verify no syntax errors, and verify runtime messages are sent as assistant responds.

- [ ] **Step 8: Commit**

```bash
git add contentScripts/chatgptResponseListener.js
git commit -m "fix(chatgpt): stream assistant replies with conversation/message ids"
```

---

## Plan self-review

- Spec coverage check:
  - Multi-message history: Task 2 implements thread list.
  - Per-message copy/collapse: Task 2 implements per-message actions.
  - Container copy=all: Task 2 Step 5.
  - Auto-scroll near bottom: Task 2 helper.
  - Listener injection wired: Task 3.
  - Listener correctness: Task 4.

- Placeholder scan: No TBD/TODO.
- Type consistency: `action: "chatgptResponse"` preserved; `conversationId/messageId/content/isComplete/timestamp` consistent across tasks.

---

## Testing checklist (manual)

1. Load unpacked extension.
2. Open sidebar.
3. Open chatgpt.com and send a message.
4. Verify sidebar shows a new card as assistant starts responding.
5. Verify card content grows while generating.
6. Verify card state becomes completed when generation ends.
7. Send another user message -> new assistant message card should append.
8. Scroll up in the sidebar thread; verify it does not yank-scroll to bottom until you scroll back near bottom.
9. Click per-message copy; verify clipboard contains only that message.
10. Click container copy; verify clipboard contains concatenated thread.
