import { platformUrls } from './ai_platform_processor.js';

const DEBUG = true;

function safeSendResponse(sendResponse, payload) {
  try {
    sendResponse(payload);
  } catch (e) {
    console.warn('[ChatGPT CDP Copy] sendResponse failed:', e);
  }
}

function log(...args) {
  if (!DEBUG) return;
  console.log('[ChatGPT CDP Copy]', ...args);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findChatGPTTab() {
  const tabs = await chrome.tabs.query({});
  const url = platformUrls.chatgpt || 'https://chatgpt.com';
  return tabs.find((t) => t.url && t.url.includes(url));
}

async function attachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve();
    });
  });
}

async function detachDebugger(tabId) {
  return new Promise((resolve) => {
    chrome.debugger.detach({ tabId }, () => resolve());
  });
}

async function send(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (result) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(result);
    });
  });
}

async function evalInPage(tabId, expression) {
  const result = await send(tabId, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  return result?.result?.value;
}

async function clickAt(tabId, x, y) {
  await send(tabId, 'Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' });
  await send(tabId, 'Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send(tabId, 'Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function getCopyButtonCenter(tabId) {
  const expr = `(() => {
    const buttons = Array.from(document.querySelectorAll('button[data-testid="copy-turn-action-button"]'))
      .map((btn) => {
        const aria = btn.getAttribute('aria-label') || '';
        const r = btn.getBoundingClientRect();
        return { btn, aria, r };
      })
      .filter(({ aria, r }) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && /复制回复|Copy reply|Copy/i.test(aria))
      .sort((a, b) => a.r.top - b.r.top);

    const pick = buttons[buttons.length - 1];
    if (!pick) return null;

    // Ensure it's actually in view, then re-measure.
    pick.btn.scrollIntoView({ block: 'center', inline: 'center' });

    const r = pick.btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const hit = document.elementFromPoint(cx, cy);
    const hitBtn = hit ? hit.closest('button[data-testid="copy-turn-action-button"]') : null;

    return {
      aria: pick.aria,
      x: Math.round(cx),
      y: Math.round(cy),
      top: Math.round(r.top),
      rect: { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) },
      hit: hit ? { tag: hit.tagName, aria: hit.getAttribute?.('aria-label') || '', className: hit.className || '' } : null,
      hitIsCopyButton: !!hitBtn,
      hitButtonAria: hitBtn ? (hitBtn.getAttribute('aria-label') || '') : null
    };
  })()`;

  return await evalInPage(tabId, expr);
}

async function isAssistantDomStable(tabId) {
  const expr = `(() => {
    const turns = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"]'));
    const last = turns[turns.length - 1];
    if (!last) return false;

    const root = last.querySelector('[data-message-content]') || last.querySelector('.markdown') || last.querySelector('.prose') || last;
    const html = root.innerHTML || '';
    const text = root.textContent || '';
    const tail = html.slice(-200);
    return `${html.length}:${text.length}:${tail}`;
  })()`;

  const sig1 = await evalInPage(tabId, expr);
  await sleep(900);
  const sig2 = await evalInPage(tabId, expr);
  return !!sig1 && sig1 === sig2;
}

export function setupChatGPTCdpCopyListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action !== 'chatgptCdpCopyLatest') return false;

    (async () => {
      // Immediate ack so caller can tell the listener exists.
      safeSendResponse(sendResponse, { status: 'started' });

      const tab = await findChatGPTTab();
      if (!tab?.id) throw new Error('ChatGPT tab not found');

      await attachDebugger(tab.id);
      try {
        await send(tab.id, 'Runtime.enable');
        await send(tab.id, 'Input.enable');

        // Wait for stable DOM state, best-effort.
        const stable = await isAssistantDomStable(tab.id);
        log('dom stable =', stable);

        const target = await getCopyButtonCenter(tab.id);
        if (!target) throw new Error('Copy button not found');

        log('click target', target);

        if (!target.hitIsCopyButton) {
          throw new Error(`CDP click would miss copy button (hit=${target.hit?.tag || 'null'})`);
        }

        await clickAt(tab.id, target.x, target.y);

        // No second sendResponse here; reply channel already used.
        // Use background logs + clipboard capture (content script) to confirm success.
      } finally {
        await detachDebugger(tab.id);
      }
    })().catch((err) => {
      safeSendResponse(sendResponse, { status: 'error', message: err?.message || String(err) });
    });

    return true;
  });

  log('listener ready');
}
