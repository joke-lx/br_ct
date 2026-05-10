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

  const DEFAULT_WINDOW_MS = 2500;

  function createClipboardCapture(config) {
    // ---------- state ----------
    let lastContext = null;
    let hooksInstalled = false;
    let clickListenerAttached = false;

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
    function autoCapture(turnRoot) {
      openContext(turnRoot, null);

      // 限定在当前 turn 内查找复制按钮
      var turnEl = (turnRoot.closest && turnRoot.closest('[data-testid^="conversation-turn-"]')) || turnRoot;
      var turnTestId = turnEl.getAttribute('data-testid');
      var btnSelector = turnTestId
        ? '[data-testid="' + turnTestId + '"] ' + config.copyBtnPrimarySelector
        : config.copyBtnPrimarySelector;

      var btn = findCopyBtn(turnRoot);
      if (btn) {
        log('autoCopy.triggerSent', { hasBtn: true, selector: btnSelector });
        window.postMessage({
          source: 'cc-capture-hook',
          type: 'trigger-copy',
          selector: btnSelector
        }, '*');
      } else {
        log('autoCopy.triggerSent', { hasBtn: false });
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
