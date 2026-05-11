/**
 * 响应监听核心引擎
 *
 * 通过 chrome.scripting.executeScript 注入，不支持 ES module。
 * 使用全局变量 window.ResponseListenerCore 暴露。
 *
 * 用法：
 *   const listener = ResponseListenerCore.createResponseListener({
 *     platform: 'chatgpt',
 *     responseSelectors: [...],
 *     ...
 *   });
 */
(function() {
  if (window.ResponseListenerCore) return;

  function createResponseListener(config) {
    const {
      platform,
      responseSelectors,
      skipTags = new Set(),
      minUpdateInterval = 100,
      captureConfig,
      getConversationId,
      getMessageId,
      isGenerating,
      settleTimeMs = 0,
    } = config;

    // ==================== 状态管理 ====================

    let observer = null;
    let initialCheckTimeout = null;
    let pendingUpdateTimeout = null;
    let settleCaptureTimer = null;
    let isMonitoring = false;
    const conversationStateById = new Map();

    // ==================== 工具函数 ====================

    function extractTextContent(element, options) {
      const st = (options && options.skipTags) || new Set();
      const blockTags = new Set([
        'P', 'DIV', 'BR', 'LI', 'TR', 'PRE', 'BLOCKQUOTE',
        'H1', 'H2', 'H3', 'H4', 'H5', 'H6'
      ]);
      var text = '';

      if (!element) return '';

      function visit(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent || '';
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        var el = node;
        if (el.getAttribute('aria-hidden') === 'true' || st.has(el.tagName)) return;

        if (el.tagName === 'A' || el.tagName === 'PRE' || el.tagName === 'CODE') {
          text += el.textContent || '';
          return;
        }
        if (el.tagName === 'BR') { text += '\n'; return; }

        var isBlock = blockTags.has(el.tagName);
        if (isBlock && text && !text.endsWith('\n')) text += '\n';

        for (var i = 0; i < el.childNodes.length; i++) visit(el.childNodes[i]);

        if (isBlock && !text.endsWith('\n')) text += '\n';
      }

      visit(element);

      return text
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/ /g, ' ')
        .trim();
    }

    function normalizeText(text) {
      return text
        .replace(/\r\n/g, '\n')
        .replace(/ /g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function getConversationState(conversationId) {
      var key = conversationId || '__default__';
      if (!conversationStateById.has(key)) {
        conversationStateById.set(key, {
          lastUpdateTime: 0,
          processedMessageKeys: new Set(),
          lastSnapshotByMessageId: new Map(),
        });
      }
      return conversationStateById.get(key);
    }

    function getMessageKey(conversationId, messageId) {
      return (conversationId || '__default__') + '::' + (messageId || 'unknown');
    }

    // ==================== 获取容器 & 内容 ====================

    function getLatestResponseContainer() {
      for (var i = 0; i < responseSelectors.length; i++) {
        var containers = document.querySelectorAll(responseSelectors[i]);
        if (containers.length > 0) {
          return containers[containers.length - 1];
        }
      }
      return null;
    }

    function readResponseContent(container) {
      if (!container) return '';

      var contentRoot =
        container.querySelector('[data-message-content]') ||
        container.querySelector('.markdown') ||
        container.querySelector('.prose') ||
        container;

      return extractTextContent(contentRoot, { skipTags: skipTags });
    }

    // ==================== 发送消息 ====================

    function sendResponseToSidebar(content, messageId, isComplete, conversationId) {
      if (isComplete === undefined) isComplete = false;
      if (conversationId === undefined) conversationId = getConversationId();

      var payload = {
        action: platform + 'Response',
        data: {
          platform: platform,
          conversationId: conversationId,
          role: 'assistant',
          content: content,
          messageId: messageId,
          isComplete: !!isComplete,
          timestamp: Date.now()
        }
      };

      chrome.runtime.sendMessage(payload).catch(function(err) {
        var msg = String((err && err.message) || err || '');
        if (msg.indexOf('Extension context invalidated') !== -1) {
          stopMonitoring();
          return;
        }
        if (msg.indexOf('Receiving end does not exist') === -1) {
          console.error('[' + platform + ' Response Listener] sendMessage failed:', err);
        }
      });
    }

    function scheduleResponseUpdate() {
      if (pendingUpdateTimeout !== null) return;
      pendingUpdateTimeout = window.setTimeout(function() {
        pendingUpdateTimeout = null;
        handleResponseUpdate();
      }, 50);
    }

    // ==================== 核心处理逻辑 ====================

    function handleResponseUpdate() {
      var conversationId = getConversationId();
      var state = getConversationState(conversationId);
      var now = Date.now();

      if (now - state.lastUpdateTime < minUpdateInterval) return;

      var container = getLatestResponseContainer();
      if (!container) return;

      var msgId = getMessageId ? getMessageId(container) : null;
      var stableMessageId = msgId || ('unknown-' + conversationId);
      var messageKey = getMessageKey(conversationId, stableMessageId);

      var content = normalizeText(readResponseContent(container));
      if (!content) return;

      var generating = isGenerating ? isGenerating() : false;
      var snapshot = content + '::' + (generating ? '1' : '0');
      var lastSnapshot = state.lastSnapshotByMessageId.get(messageKey);

      if (state.processedMessageKeys.has(messageKey) && lastSnapshot === snapshot) return;
      if (snapshot === lastSnapshot) return;

      sendResponseToSidebar(content, stableMessageId, !generating, conversationId);

      if (!generating) {
        if (settleTimeMs > 0) {
          // 流式平台：等待内容稳定后再触发捕获，避免捕获到不完整内容
          scheduleSettledCapture(container);
        } else {
          var capture = tryGetCapture();
          if (capture) {
            var turnRoot = findTurnRootFromContainer(container);
            if (turnRoot) capture.autoCapture(turnRoot);
          }
        }
      } else {
        // 生成中：清除之前的 settle timer，内容变化时重新计时
        clearSettleTimer();
      }

      state.lastUpdateTime = now;
      state.lastSnapshotByMessageId.set(messageKey, snapshot);

      if (!generating) {
        state.processedMessageKeys.add(messageKey);
      }
    }

    function findTurnRootFromContainer(container) {
      if (!(container instanceof Element)) return null;
      // 优先使用平台专用的 turnSelectors（定位包含操作栏的完整 turn 容器）
      var turnSelectors = config.turnSelectors || config.responseSelectors;
      for (var i = 0; i < turnSelectors.length; i++) {
        var turn = container.closest(turnSelectors[i]);
        if (turn) return turn;
      }
      return container;
    }

    // ==================== 剪贴板捕获 ====================

    var _captureInstance = null;

    function tryGetCapture() {
      if (!captureConfig) return null;
      if (_captureInstance) return _captureInstance;
      var name = typeof captureConfig === 'string' ? captureConfig : null;
      if (!name) return null;
      var cfg = window[name];
      if (!cfg || !window.ClipboardCapture) return null;
      _captureInstance = window.ClipboardCapture.create(cfg);
      return _captureInstance;
    }

    // ==================== 内容稳定后捕获 ====================

    function clearSettleTimer() {
      if (settleCaptureTimer !== null) {
        clearTimeout(settleCaptureTimer);
        settleCaptureTimer = null;
      }
    }

    function scheduleSettledCapture(container) {
      clearSettleTimer();
      settleCaptureTimer = setTimeout(function() {
        settleCaptureTimer = null;
        var capture = tryGetCapture();
        if (!capture) return;
        var turnRoot = findTurnRootFromContainer(container);
        if (turnRoot) capture.autoCapture(turnRoot);
      }, settleTimeMs);
    }

    // ==================== MutationObserver ====================

    function handleMutations(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          scheduleResponseUpdate();
          break;
        }
      }
    }

    // ==================== 启动 / 停止 ====================

    function startMonitoring() {
      if (isMonitoring) {
        console.log('[' + platform + ' Response Listener] already running');
        return;
      }

      if (!document.body) {
        initialCheckTimeout = window.setTimeout(function() {
          initialCheckTimeout = null;
          startMonitoring();
        }, 100);
        return;
      }

      console.log('[' + platform + ' Response Listener] starting');

      var capture = tryGetCapture();
      if (capture) {
        capture.installHooks();
        capture.setupClickListener();
      }

      observer = new MutationObserver(handleMutations);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });

      isMonitoring = true;

      initialCheckTimeout = window.setTimeout(function() {
        initialCheckTimeout = null;
        scheduleResponseUpdate();
      }, 500);
    }

    function stopMonitoring() {
      if (initialCheckTimeout !== null) {
        window.clearTimeout(initialCheckTimeout);
        initialCheckTimeout = null;
      }
      if (pendingUpdateTimeout !== null) {
        window.clearTimeout(pendingUpdateTimeout);
        pendingUpdateTimeout = null;
      }
      clearSettleTimer();
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      isMonitoring = false;
      console.log('[' + platform + ' Response Listener] stopped');
    }

    window.addEventListener('pagehide', stopMonitoring, { once: true });

    // ==================== 自动启动 ====================

    (function autoStart() {
      var hostnames = config.hostnames || [];
      var currentHostname = window.location.hostname;
      var matched = hostnames.length === 0 || hostnames.some(function(h) {
        return currentHostname.indexOf(h) !== -1;
      });

      if (matched) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', startMonitoring);
        } else {
          startMonitoring();
        }
      }
    })();

    return { startMonitoring: startMonitoring, stopMonitoring: stopMonitoring };
  }

  window.ResponseListenerCore = { createResponseListener: createResponseListener };
})();
