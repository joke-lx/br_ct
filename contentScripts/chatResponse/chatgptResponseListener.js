/**
 * ChatGPT 回复监听模块
 *
 * 仿照 openteam gemini.js 的方式，监听 ChatGPT 页面的回复
 * 并实时提取内容发送到侧边栏进行流式渲染
 */
(() => {
  if (window.__chatgptResponseListenerInjected) {
    return;
  }
  window.__chatgptResponseListenerInjected = true;

  // ==================== Copy Capture Harness (Task 1) ====================

  const DEBUG_COPY_CAPTURE = true;

  function logCopyCapture(label, data) {
    if (!DEBUG_COPY_CAPTURE) return;
    console.log(`[ChatGPT Copy Capture] ${label}`, data);
  }

  function normalizeCopyCapture(payload) {
    const now = Date.now();

    const rawHtml = typeof payload?.html === "string" ? payload.html : null;
    const rawText = typeof payload?.text === "string" ? payload.text : null;

    const html = rawHtml && rawHtml.trim() ? rawHtml : null;
    const text = rawText && rawText.trim() ? normalizeText(rawText) : null;

    if (!html && !text) return null;

    const ctx = getActiveCopyContext();
    if (ctx) {
      return {
        platform: "chatgpt",
        conversationId: ctx.conversationId,
        messageId: ctx.messageId,
        html,
        text,
        htmlMissing: !html,
        source: payload?.source || "unknown",
        timestamp: now
      };
    }

    // 无上下文时仍捕获，使用当前 conversationId 兜底
    return {
      platform: "chatgpt",
      conversationId: getConversationId(),
      messageId: null,
      html,
      text,
      htmlMissing: !html,
      source: payload?.source || "unknown",
      timestamp: now
    };
  }

  function captureClipboardPayload(payload) {
    const normalized = normalizeCopyCapture(payload);
    if (!normalized) return;

    logCopyCapture("capture", normalized);

    lastCopyCaptureByMessageId.set(normalized.messageId, { ts: normalized.timestamp, source: normalized.source });

    chrome.runtime
      .sendMessage({ action: "chatgptCopyCapture", data: normalized })
      .catch((err) => {
        // 忽略接收端不存在时的错误（例如 sidebar 未打开）
        if (!err?.message?.includes("Receiving end does not exist")) {
          console.error("[ChatGPT Copy Capture] sendMessage failed:", err);
        }
      });
  }

  // ==================== 配置 ====================

  const CONFIG = {
    // ChatGPT assistant turn 容器选择器
    responseSelectors: [
      // 1) turn 容器自身带 role
      '[data-testid^="conversation-turn-"][data-message-author-role="assistant"]',
      // 2) turn 容器内部的 role 节点（不同版本 DOM 会这样组织）
      '[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
      // 3) 兜底：任何 assistant role 节点
      '[data-message-author-role="assistant"]'
    ],

    // 需要跳过的标签
    skipTags: new Set([
      "BUTTON",
      "SCRIPT",
      "STYLE",
      "SVG",
      "PATH",
      "MathJAX"
    ]),

    // 流式更新的最小间隔（毫秒）
    minUpdateInterval: 100
  };

  // ==================== 状态管理 ====================

  let observer = null;
  let initialCheckTimeout = null;
  let pendingUpdateTimeout = null;
  let isMonitoring = false;
  const conversationStateById = new Map();

  // ==================== Copy Capture Context (Task 2) ====================

  let lastCopyContext = null;
  const COPY_CAPTURE_WINDOW_MS = 2500;
  let copyClickListenerAttached = false;
  let clipboardHooksInstalled = false;
  const lastCopyCaptureByMessageId = new Map();

  // ==================== 工具函数 ====================

  /**
   * 提取文本内容（仿照 gemini.js 的 extractTextContent）
   */
  function extractTextContent(element, options = {}) {
    const { skipTags = new Set() } = options;
    const blockTags = new Set([
      "P",
      "DIV",
      "BR",
      "LI",
      "TR",
      "PRE",
      "BLOCKQUOTE",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6"
    ]);
    let text = "";

    if (!element) return "";

    function visit(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || "";
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const currentElement = node;
      if (
        currentElement.getAttribute("aria-hidden") === "true" ||
        skipTags.has(currentElement.tagName)
      ) {
        return;
      }

      if (currentElement.tagName === "A") {
        text += currentElement.textContent || "";
        return;
      }

      if (currentElement.tagName === "PRE" || currentElement.tagName === "CODE") {
        text += currentElement.textContent || "";
        return;
      }

      if (currentElement.tagName === "BR") {
        text += "\n";
        return;
      }

      const isBlock = blockTags.has(currentElement.tagName);
      if (isBlock && text && !text.endsWith("\n")) {
        text += "\n";
      }

      for (const child of currentElement.childNodes) {
        visit(child);
      }

      if (isBlock && !text.endsWith("\n")) {
        text += "\n";
      }
    }

    visit(element);

    return text
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/ /g, " ")
      .trim();
  }

  function getConversationId() {
    try {
      const url = new URL(window.location.href);
      const parts = url.pathname.split("/").filter(Boolean);
      const conversationSegmentIndex = parts.indexOf("c");

      if (conversationSegmentIndex !== -1 && parts[conversationSegmentIndex + 1]) {
        return parts[conversationSegmentIndex + 1];
      }

      if (parts[0] === "chat" && parts[1]) {
        return parts[1];
      }
    } catch (error) {
      console.warn("[ChatGPT Response Listener] 解析 conversationId 失败:", error);
    }

    return "__default__";
  }

  function getConversationState(conversationId) {
    const conversationKey = conversationId || "__default__";

    if (!conversationStateById.has(conversationKey)) {
      conversationStateById.set(conversationKey, {
        lastUpdateTime: 0,
        processedMessageKeys: new Set(),
        lastSnapshotByMessageId: new Map()
      });
    }

    return conversationStateById.get(conversationKey);
  }

  function getMessageKey(conversationId, messageId) {
    return `${conversationId || "__default__"}::${messageId || "unknown"}`;
  }

  /**
   * 获取最新的回复容器
   */
  function getLatestResponseContainer() {
    for (const selector of CONFIG.responseSelectors) {
      const containers = document.querySelectorAll(selector);
      if (containers.length > 0) {
        // 返回最后一个（最新的）容器
        return containers[containers.length - 1];
      }
    }
    return null;
  }

  /**
   * 获取消息 ID
   */
  function getMessageId(element) {
    if (!element) return null;

    // 尝试从 data-testid 获取
    const testId = element.getAttribute("data-testid");
    if (testId) {
      const match = testId.match(/conversation-turn-(\d+)/);
      if (match) return match[1];
    }

    // 尝试从父级获取
    const parent = element.closest('[data-testid^="conversation-turn-"]');
    if (parent) {
      const parentTestId = parent.getAttribute("data-testid");
      const match = parentTestId.match(/conversation-turn-(\d+)/);
      if (match) return match[1];
    }

    return null;
  }

  // ==================== Copy Capture Helpers (Task 2) ====================

  function getAssistantTurnFromTarget(target) {
    if (!(target instanceof Element)) return null;

    for (const selector of CONFIG.responseSelectors) {
      const turn = target.closest(selector);
      if (turn) return turn;
    }

    return null;
  }

  function isCopyLikeControl(element) {
    if (!(element instanceof Element)) return false;

    // 直接匹配 data-testid（ChatGPT 的 icon-only 复制按钮）
    if (element.closest('[data-testid="copy-turn-action-button"]')) return true;

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

    logCopyCapture("context.open", {
      conversationId,
      messageId,
      sourceTarget
    });
  }

  function getActiveCopyContext() {
    if (!lastCopyContext) return null;

    if (Date.now() - lastCopyContext.openedAt > COPY_CAPTURE_WINDOW_MS) {
      lastCopyContext = null;
      return null;
    }

    return lastCopyContext;
  }

  async function readClipboardItemData(item) {
    if (!item || typeof item.getType !== "function" || !Array.isArray(item.types)) {
      return { html: null, text: null };
    }

    const htmlBlobPromise = item.types.includes("text/html") ? item.getType("text/html") : null;
    const textBlobPromise = item.types.includes("text/plain") ? item.getType("text/plain") : null;

    const [htmlBlob, textBlob] = await Promise.all([
      htmlBlobPromise ? htmlBlobPromise.catch(() => null) : Promise.resolve(null),
      textBlobPromise ? textBlobPromise.catch(() => null) : Promise.resolve(null)
    ]);

    const [html, text] = await Promise.all([
      htmlBlob ? htmlBlob.text().catch(() => null) : Promise.resolve(null),
      textBlob ? textBlob.text().catch(() => null) : Promise.resolve(null)
    ]);

    return {
      html: typeof html === "string" ? html : null,
      text: typeof text === "string" ? text : null
    };
  }

  function installClipboardHooks() {
    if (clipboardHooksInstalled) return;
    clipboardHooksInstalled = true;

    // 1. 注入主世界 clipboard hook（content script 对 navigator.clipboard 的修改在主世界不可见）
    if (!document.querySelector('script[data-cc-capture-hook]')) {
      const script = document.createElement('script');
      script.setAttribute('data-cc-capture-hook', '');
      script.textContent = `
(function() {
  if (window.__ccCaptureHook) return;
  window.__ccCaptureHook = true;
  var _w = navigator.clipboard.write.bind(navigator.clipboard);
  var _wt = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.write = async function(items) {
    var html = null, text = null;
    for (var i = 0; i < (items || []).length; i++) {
      try { if (items[i].types.includes('text/html')) { var b = await items[i].getType('text/html'); html = await b.text(); } } catch(e) {}
      try { if (items[i].types.includes('text/plain')) { var b = await items[i].getType('text/plain'); text = await b.text(); } } catch(e) {}
    }
    window.dispatchEvent(new CustomEvent('__ccCapture', { detail: { html: html || null, text: text || null, source: 'clipboard.write' } }));
    try { return await _w(items); } catch(e) { return Promise.resolve(); }
  };
  navigator.clipboard.writeText = async function(text) {
    window.dispatchEvent(new CustomEvent('__ccCapture', { detail: { html: null, text: String(text || ''), source: 'clipboard.writeText' } }));
    try { return await _wt(text); } catch(e) { return Promise.resolve(); }
  };
  document.addEventListener('copy', function(e) {
    try {
      var text = null, html = null;
      try { text = e.clipboardData.getData('text/plain'); } catch(ex) {}
      try { html = e.clipboardData.getData('text/html'); } catch(ex) {}
      if (text || html) {
        window.dispatchEvent(new CustomEvent('__ccCapture', { detail: { html: html || null, text: text || null, source: 'copy.event' } }));
      }
    } catch(ex) {}
  });
})();
`;
      document.documentElement.appendChild(script);
      script.remove();
    }

    // 2. 监听主世界发来的 clipboard capture 事件
    window.addEventListener('__ccCapture', (event) => {
      captureClipboardPayload(event.detail || {});
    });

    // 3. DataTransfer.setData（prototype 共享，可直接 hook）
    const originalSetData = window.DataTransfer?.prototype?.setData;
    if (typeof originalSetData === "function") {
      window.DataTransfer.prototype.setData = function (type, data) {
        if (type === "text/html" || type === "text/plain") {
          captureClipboardPayload({
            html: type === "text/html" ? String(data ?? "") : null,
            text: type === "text/plain" ? String(data ?? "") : null,
            source: "dt.setData"
          });
        }
        return originalSetData.call(this, type, data);
      };
    }

    logCopyCapture("hooks.installed");
  }

  /**
   * 读取回复内容
   */
  function readResponseContent(container) {
    if (!container) return "";

    // 限定在 assistant turn 内部的正文区域读取，避免误读通用 markdown 节点
    const contentRoot = container.querySelector("[data-message-content]") ||
                        container.querySelector(".markdown") ||
                        container.querySelector(".prose") ||
                        container;

    return extractTextContent(contentRoot, { skipTags: CONFIG.skipTags });
  }

  /**
   * 检查是否正在生成回复
   */
  function isGenerating() {
    return Array.from(document.querySelectorAll("button")).some((button) => {
      const label = [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.textContent
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return /stop|stopping|停止|中止/.test(label) &&
        !button.disabled &&
        button.getAttribute("aria-disabled") !== "true";
    });
  }

  /**
   * 规范化文本（保留换行，只做最小清理）
   */
  function normalizeText(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/ /g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * 发送回复到侧边栏
   */
  function sendResponseToSidebar(content, messageId, isComplete = false, conversationId = getConversationId()) {
    const payload = {
      action: "chatgptResponse",
      data: {
        platform: "chatgpt",
        conversationId,
        role: "assistant",
        content,
        messageId,
        isComplete,
        timestamp: Date.now()
      }
    };

    console.log("[ChatGPT Response Listener] sending", payload);

    try {
      chrome.runtime.sendMessage(payload).catch((err) => {
        const msg = String(err?.message || err || "");
        // 扩展重载/更新时 content script 还在跑，会出现 context invalidated
        if (msg.includes("Extension context invalidated")) {
          stopMonitoring();
          return;
        }
        // 忽略接收端不存在时的错误
        if (!msg.includes("Receiving end does not exist")) {
          console.error("发送回复到侧边栏失败:", err);
        }
      });
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (msg.includes("Extension context invalidated")) {
        stopMonitoring();
        return;
      }
      throw err;
    }
  }

  function scheduleResponseUpdate() {
    if (pendingUpdateTimeout !== null) {
      return;
    }

    pendingUpdateTimeout = window.setTimeout(() => {
      pendingUpdateTimeout = null;
      handleResponseUpdate();
    }, 50);
  }

  function findTurnRootFromContainer(container) {
    if (!(container instanceof Element)) return null;
    return container.closest('[data-testid^="conversation-turn-"]') || container;
  }

  function findCopyReplyButton(turnRoot) {
    if (!(turnRoot instanceof Element)) return null;

    return (
      turnRoot.querySelector('button[data-testid="copy-turn-action-button"]') ||
      turnRoot.querySelector('button[aria-label*="复制回复"]') ||
      turnRoot.querySelector('button[aria-label*="Copy"]')
    );
  }

  function deriveTurnHtmlFallback(turnRoot) {
    if (!(turnRoot instanceof Element)) return null;

    const contentRoot =
      turnRoot.querySelector("[data-message-content]") ||
      turnRoot.querySelector(".markdown") ||
      turnRoot.querySelector(".prose") ||
      turnRoot;

    return contentRoot instanceof Element ? contentRoot.innerHTML : null;
  }

  function attemptAutoCopyForCompletedTurn(turnRoot) {
    // Auto-triggering ChatGPT's built-in copy button is unreliable due to user-activation
    // restrictions and can cause the page to toast.error + unhandled promise rejections.
    // For stability, always capture via DOM-derived HTML.

    openCopyCaptureWindow(turnRoot, null);

    const html = deriveTurnHtmlFallback(turnRoot);
    if (html) {
      captureClipboardPayload({
        html,
        text: null,
        source: "dom.html.auto"
      });
    } else {
      logCopyCapture("autoCopy.skip", { reason: "dom html fallback missing" });
    }

    // Close the context immediately so later unrelated clipboard writes aren't mis-attributed.
    lastCopyContext = null;
  }

  // ==================== 监听逻辑 ====================

  /**
   * 处理回复更新
   */
  function handleResponseUpdate() {
    const conversationId = getConversationId();
    const state = getConversationState(conversationId);
    const now = Date.now();

    // 限流：避免过于频繁的更新
    if (now - state.lastUpdateTime < CONFIG.minUpdateInterval) {
      return;
    }

    const container = getLatestResponseContainer();
    if (!container) return;

    const messageId = getMessageId(container);
    const stableMessageId = messageId || `unknown-${conversationId}`;
    const messageKey = getMessageKey(conversationId, stableMessageId);

    const content = normalizeText(readResponseContent(container));
    if (!content) {
      return;
    }

    const generating = isGenerating();
    const snapshot = `${content}::${generating ? "1" : "0"}`;
    const lastSnapshot = state.lastSnapshotByMessageId.get(messageKey);

    // 跳过已完成且已处理的消息
    if (state.processedMessageKeys.has(messageKey) && lastSnapshot === snapshot) {
      return;
    }

    const shouldSend = snapshot !== lastSnapshot;

    if (!shouldSend) {
      return;
    }

    sendResponseToSidebar(content, stableMessageId, !generating, conversationId);

    if (!generating) {
      const turnRoot = findTurnRootFromContainer(container);
      if (turnRoot) {
        attemptAutoCopyForCompletedTurn(turnRoot);
      }
    }

    state.lastUpdateTime = now;
    state.lastSnapshotByMessageId.set(messageKey, snapshot);

    // 如果消息生成完成，标记为已处理
    if (!generating) {
      state.processedMessageKeys.add(messageKey);
    }
  }

  /**
   * MutationObserver 回调
   */
  function handleMutations(mutations) {
    for (const mutation of mutations) {
      // 只处理相关的节点变化
      if (mutation.type === "childList" || mutation.type === "characterData") {
        scheduleResponseUpdate();
        break; // 每批突变只处理一次
      }
    }
  }

  /**
   * 启动监听
   */
  function startMonitoring() {
    if (isMonitoring) {
      console.log("[ChatGPT Response Listener] 监听已在运行");
      return;
    }

    if (!document.body) {
      initialCheckTimeout = window.setTimeout(() => {
        initialCheckTimeout = null;
        startMonitoring();
      }, 100);
      return;
    }

    console.log("[ChatGPT Response Listener] 启动监听");

    installClipboardHooks();

    if (!copyClickListenerAttached) {
      document.addEventListener(
        "click",
        (event) => {
          const target = event.target;
          const turn = getAssistantTurnFromTarget(target);
          if (!turn) return;

          // Copy UI 通常是 button / role=button，且带 copy/复制 的 aria-label/title/text
          const candidate =
            (target instanceof Element && target.closest?.("button, [role='button']")) ||
            target;

          if (!isCopyLikeControl(target) && !isCopyLikeControl(candidate)) {
            return;
          }

          openCopyCaptureWindow(turn, target);
        },
        true
      );

      copyClickListenerAttached = true;
      logCopyCapture("listener.attached", { type: "document.click.capture" });
    }

    // 创建观察器
    observer = new MutationObserver(handleMutations);

    // 开始观察整个文档
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    isMonitoring = true;

    // 立即检查一次现有内容
    initialCheckTimeout = window.setTimeout(() => {
      initialCheckTimeout = null;
      scheduleResponseUpdate();
    }, 500);
  }

  /**
   * 停止监听
   */
  function stopMonitoring() {
    if (initialCheckTimeout !== null) {
      window.clearTimeout(initialCheckTimeout);
      initialCheckTimeout = null;
    }

    if (pendingUpdateTimeout !== null) {
      window.clearTimeout(pendingUpdateTimeout);
      pendingUpdateTimeout = null;
    }

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    isMonitoring = false;
    console.log("[ChatGPT Response Listener] 停止监听");
  }

  window.addEventListener("pagehide", stopMonitoring, { once: true });

  // ==================== 自动启动 ====================

  // 检查是否在 ChatGPT 页面
  if (window.location.hostname === "chatgpt.com" ||
      window.location.hostname === "chat.openai.com") {
    // 页面加载完成后启动监听
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startMonitoring);
    } else {
      startMonitoring();
    }
  }
})();
