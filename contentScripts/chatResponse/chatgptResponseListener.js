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

  const capture = window.ClipboardCapture.create(window.chatgptCaptureConfig);

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

  // ==================== 工具函数（续） ====================

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
        capture.autoCapture(turnRoot);
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

    capture.installHooks();
    capture.setupClickListener();

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
