/**
 * 剪贴板捕获核心引擎
 *
 * 通过 chrome.scripting.executeScript({ files }) 注入，不支持 ES module。
 * 用全局变量 window.ClipboardCapture 暴露。
 *
 * 用法：
 *   const capture = ClipboardCapture.create(config);
 *   capture.installHooks();
 *   capture.autoCapture(turnRoot);
 */
(function() {
  if (window.ClipboardCapture) return;

  const DEFAULT_WINDOW_MS = 6000;

  function createClipboardCapture(config) {
    // ---------- state ----------
    let lastContext = null;
    let hooksInstalled = false;
    let clickListenerAttached = false;
    var _capturingIds = new Set(); // dedup: skip duplicate autoCapture for same message

    function log(label, data) {
      if (config.debug !== false) {
        console.log('[' + config.name + ' Copy Capture] ' + label, data);
      }
    }

    // ==================== extract text ====================
    function extractTextFrom(root) {
      if (!(root instanceof Element)) return '';
      var skipTags = config.skipTags || new Set();
      var blockTags = new Set([
        'P','DIV','BR','LI','TR','PRE','BLOCKQUOTE','H1','H2','H3','H4','H5','H6'
      ]);
      var text = '';

      function visit(node) {
        if (node.nodeType === Node.TEXT_NODE) { text += node.textContent || ''; return; }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        var el = node;
        if (el.getAttribute('aria-hidden') === 'true' || skipTags.has(el.tagName)) return;
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

      visit(root);
      return text
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/ /g, ' ')
        .trim();
    }

    // ==================== hooks ====================
    function installHooks() {
      if (hooksInstalled) return;
      hooksInstalled = true;

      // 1. 注入主世界脚本（CSP-safe：chrome.runtime.getURL）
      if (!document.getElementById('__ccCaptureHookScript')) {
        var s = document.createElement('script');
        s.id = '__ccCaptureHookScript';
        s.src = chrome.runtime.getURL('contentScripts/clipboardCapture/mainWorldHook.js');
        document.documentElement.appendChild(s);
        s.remove();
      }

      // 2. 监听主世界发来的 postMessage
      window.addEventListener('message', function(e) {
        if (e.data && e.data.source === 'cc-capture-hook' && e.data.type === 'clipboard-data') {
          _capture(e.data.payload || {});
        }
      });

      // 3. DataTransfer.setData hook（prototype 共享，可直接 hook）
      var origSetData = window.DataTransfer && window.DataTransfer.prototype && window.DataTransfer.prototype.setData;
      if (typeof origSetData === 'function') {
        window.DataTransfer.prototype.setData = function(type, data) {
          if (type === 'text/html' || type === 'text/plain') {
            _capture({
              html: type === 'text/html' ? String(data || '') : null,
              text: type === 'text/plain' ? String(data || '') : null,
              source: 'dt.setData'
            });
          }
          return origSetData.call(this, type, data);
        };
      }

      log('hooks.installed');
    }

    // ==================== context ====================
    function openContext(turnElement, sourceTarget) {
      var conversationId = config.getConversationId();
      var messageId = config.getMessageId ? config.getMessageId(turnElement) : null;
      messageId = messageId || ('unknown-' + conversationId);
      lastContext = {
        turnElement: turnElement,
        conversationId: conversationId,
        messageId: messageId,
        sourceTarget: sourceTarget,
        openedAt: Date.now()
      };
      log('context.open', { conversationId: conversationId, messageId: messageId, sourceTarget: sourceTarget });
    }

    function getActiveContext() {
      if (!lastContext) return null;
      if (Date.now() - lastContext.openedAt > (config.contextWindowMs || DEFAULT_WINDOW_MS)) {
        lastContext = null;
        return null;
      }
      return lastContext;
    }

    // ==================== capture pipeline ====================
    function normalizeText(text) {
      return text.replace(/\r\n/g, '\n').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }

    function _normalize(payload) {
      var html = typeof payload.html === 'string' ? payload.html.trim() || null : null;
      var rawText = typeof payload.text === 'string' ? payload.text : null;
      var text = rawText && rawText.trim() ? normalizeText(rawText) : null;
      if (!html && !text) return null;

      var ctx = getActiveContext();
      return {
        platform: config.name,
        conversationId: ctx ? ctx.conversationId : config.getConversationId(),
        messageId: ctx ? ctx.messageId : null,
        html: html,
        text: text,
        htmlMissing: !html,
        source: payload.source || 'unknown',
        timestamp: Date.now()
      };
    }

    function _capture(payload) {
      var n = _normalize(payload);
      if (!n) return;
      log('capture', n);
      chrome.runtime.sendMessage({ action: config.action, data: n }).catch(function(err) {
        if (err && err.message && err.message.indexOf('Receiving end does not exist') === -1) {
          console.error('[' + config.name + ' Copy Capture] sendMessage failed:', err);
        }
      });
    }

    // ==================== DOM helpers ====================
    function getSearchRoot(turnRoot) {
      if (typeof config.getCopyBtnRoot === 'function') {
        var custom = config.getCopyBtnRoot(turnRoot);
        if (custom instanceof Element) return custom;
      }
      return turnRoot;
    }

    function findCopyBtn(turnRoot) {
      if (!(turnRoot instanceof Element)) return null;
      var root = getSearchRoot(turnRoot);
      var selectors = config.copyBtnSelectors;
      for (var i = 0; i < selectors.length; i++) {
        var btn = root.querySelector(selectors[i]);
        if (btn) return btn;
      }
      return null;
    }

    function getContentRoot(turnRoot) {
      if (!(turnRoot instanceof Element)) return null;
      return config.getContentRoot ? config.getContentRoot(turnRoot) : turnRoot;
    }

    function deriveHtmlFallback(turnRoot) {
      var root = getContentRoot(turnRoot);
      return root instanceof Element ? root.innerHTML : null;
    }

    function deriveTextFallback(turnRoot) {
      var root = getContentRoot(turnRoot);
      return root ? extractTextFrom(root) : null;
    }

    // ==================== auto capture ====================

    var RETRY_INTERVALS = [100, 300, 700, 1500, 3000];

    function tryCopyBtn(turnRoot, btnSelector, retryIndex) {
      var btn = findCopyBtn(turnRoot);
      if (btn) {
        log('autoCopy.triggerSent', { hasBtn: true, selector: btnSelector, retry: retryIndex + 1 });
        window.postMessage({
          source: 'cc-capture-hook',
          type: 'trigger-copy',
          selector: btnSelector
        }, '*');
        return true;
      }
      if (retryIndex < RETRY_INTERVALS.length) {
        var delay = RETRY_INTERVALS[retryIndex];
        log('autoCopy.retry', { retry: retryIndex + 1, delay: delay });
        setTimeout(function() {
          tryCopyBtn(turnRoot, btnSelector, retryIndex + 1);
        }, delay);
      } else {
        log('autoCopy.retry.giveUp', { retries: RETRY_INTERVALS.length });
      }
      return false;
    }

    function autoCapture(turnRoot) {
      // Dedup: 防止同一个 turn 被多次 autoCapture
      // 场景：simulateCopy 触发 DOM 变化 → MutationObserver → handleResponseUpdate → autoCapture 循环
      var dedupId = null;
      if (turnRoot instanceof Element) {
        if (config.getMessageId) {
          dedupId = config.getMessageId(turnRoot);
        }
        if (!dedupId && turnRoot.dataset && turnRoot.dataset.testid) {
          dedupId = turnRoot.dataset.testid;
        }
      }
      if (dedupId && _capturingIds.has(dedupId)) {
        log('autoCapture.skip', { reason: 'already capturing', messageId: dedupId });
        return;
      }
      if (dedupId) {
        _capturingIds.add(dedupId);
        // 所有重试完成（2600ms）+ 额外安全缓冲后清理 dedup
        setTimeout(function() { _capturingIds.delete(dedupId); }, 5000);
      }

      openContext(turnRoot, null);

      // 确保 turn 有 data-testid 用于按钮选择器作用域限定
      // 某些平台（如豆包）的 turn 容器没有原生 data-testid，导致 btnSelector 无作用域，
      // mainWorldHook 的 document.querySelector() 取到第一个匹配（上一个 turn）而非当前 turn
      var turnEl = (turnRoot.closest && turnRoot.closest('[data-testid^="conversation-turn-"]')) || turnRoot;
      var turnTestId = turnEl.getAttribute('data-testid');
      if (!turnTestId) {
        turnTestId = dedupId && typeof dedupId === 'string' ? dedupId : ('cc-turn-' + Date.now());
        turnEl.setAttribute('data-testid', turnTestId);
      }
      var btnSelector = '[data-testid="' + turnTestId + '"] ' + config.copyBtnPrimarySelector;

      var btn = findCopyBtn(turnRoot);
      if (btn) {
        log('autoCopy.triggerSent', { hasBtn: true, selector: btnSelector, retry: 0 });
        window.postMessage({
          source: 'cc-capture-hook',
          type: 'trigger-copy',
          selector: btnSelector
        }, '*');
      } else {
        log('autoCopy.triggerSent', { hasBtn: false, retry: 0 });
        tryCopyBtn(turnRoot, btnSelector, 0);
      }

      // DOM 兜底
      var html = deriveHtmlFallback(turnRoot);
      var text = deriveTextFallback(turnRoot);
      if (html) {
        _capture({ html: html, text: text || null, source: 'dom.auto' });
      } else {
        log('autoCopy.skip', { reason: 'dom html fallback missing' });
      }

      // 不立即清除 lastContext，让 contextWindowMs 超时机制自动清理，
      // 确保异步到达的 clipboard write 数据能获取到正确的 messageId
    }

    // ==================== click listener ====================
    function setupClickListener() {
      if (clickListenerAttached) return;
      clickListenerAttached = true;

      document.addEventListener('click', function(e) {
        // 跳过脚本 dispatchEvent 产生的模拟点击（isTrusted===false），
        // 避免 autoCapture 的 simulateCopy 触发二次 context.open
        if (!e.isTrusted) return;
        var target = e.target;
        var turn = config.detectTurn ? config.detectTurn(target) : null;
        if (!turn) return;

        var candidate = (target instanceof Element && target.closest && target.closest('button, [role="button"]')) || target;
        if (!config.isCopyControl(target) && !config.isCopyControl(candidate)) return;

        openContext(turn, target);
      }, true);

      log('listener.attached');
    }

    // ==================== public API ====================
    return {
      installHooks: installHooks,
      autoCapture: autoCapture,
      openContext: openContext,
      setupClickListener: setupClickListener,
      _capture: _capture,
    };
  }

  window.ClipboardCapture = { create: createClipboardCapture };
})();
