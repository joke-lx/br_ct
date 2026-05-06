---
name: page-requirements
description: Use when building options/popup/iframe pages in this Chrome extension. Covers: no native browser dialogs, user-initiated disconnect wins over auto-reconnect, shared singleton connection via background relay.
---

# Page Requirements for Extension UI

## Triggering Conditions

- Building any options page, popup, or iframe-based UI
- Need to communicate with native host from multiple pages
- Need to confirm dangerous operations (delete, stop, push)
- User says "不要 alert"、"无系统弹窗"、"自定义通知"
- User says "单例"、"共享连接"
- User says "断开后不该自动重连"

## Core Patterns

### 1. No System Dialogs (P0)

**Rule:** Never use `alert()`, `confirm()`, `prompt()`.

**Toast for notifications:**
```javascript
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
```

**Two-click confirmation for dangerous actions:**
```javascript
function needConfirm(btn) {
  if (btn.dataset.confirmed === 'true') {
    btn.dataset.confirmed = '';
    return false; // execute
  }
  btn.dataset.origText = btn.textContent;
  btn.dataset.confirmed = 'true';
  btn.textContent = '确认?';
  btn.classList.add('btn-confirm-pending');
  setTimeout(() => {
    if (btn.dataset.confirmed === 'true') {
      btn.dataset.confirmed = '';
      btn.textContent = btn.dataset.origText;
      btn.classList.remove('btn-confirm-pending');
    }
  }, 2500);
  return true; // wait
}
```

### 2. Singleton via Background Relay (P1)

**Rule:** All pages share one native host connection through background relay. No page calls `connectNative()` directly.

```
Page A ──sendMessage──> Background native_relay ──connectNative──> Native Host
Page B ──sendMessage──> Background native_relay        (singleton)
```

**Background relay (`backgroudtask/native_relay/index.js`):**
```javascript
let nativePort = null;
let pendingRequests = [];
let userDisconnected = false; // blocks auto-reconnect after user-initiated disconnect

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'nativeConnect') {
    userDisconnected = false;
    connect();
    sendResponse({ status: nativePort ? 'ok' : 'error' });
    return false;
  }
  if (message.action === 'nativeDisconnect') {
    userDisconnected = true; // mark user-initiated
    nativePort?.disconnect();
    nativePort = null;
    sendResponse({ status: 'ok' });
    return false;
  }
  if (message.action !== 'nativeMessage') return false;

  if (!nativePort) {
    if (userDisconnected) {
      sendResponse({ status: 'error', message: '已断开，请点击"启动"连接' });
      return false;
    }
    connect();
  }

  pendingRequests.push({ sendResponse });
  nativePort.postMessage(message.payload);
  return true;
});
```

**Every page uses the same call pattern:**
```javascript
function sendNativeMessage(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'nativeMessage', payload }, (response) => {
      if (response.status === 'error') reject(new Error(response.message));
      else resolve(response);
    });
  });
}
```

### 3. Auto-Reconnect Below User Intent (P2)

**Rule:** `userDisconnected` flag must block auto-reconnect after user clicks "disconnect".

```javascript
let userDisconnected = false;

function disconnect() {
  userDisconnected = true; // blocks future auto-reconnect
  nativePort?.disconnect();
  nativePort = null;
}

nativePort.onDisconnect.addListener(() => {
  if (!userDisconnected) {
    setTimeout(() => connect(), 3000);
  }
});
```

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Each page calls `connectNative()` | Multiple native host processes, disconnect one doesn't affect others | Use background relay |
| No `userDisconnected` flag | User clicks "disconnect" but it reconnects after 3s | Add flag, check in `onDisconnect` |
| `alert('error')` in extension page | Browser alert blocks UI thread | Use toast() |
| `confirm('Sure?')` for dangerous ops | System dialog is jarring | Use two-click `needConfirm()` |

## Priority

| Priority | Rule | Why |
|----------|-------|-----|
| P0 | No system dialogs | Extension UI must feel native |
| P1 | Singleton relay | One native host process per browser |
| P2 | User intent > auto-retry | Users control when they want to disconnect |
