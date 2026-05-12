/**
 * 豆包 (Doubao) 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 */
(function() {
  if (window.doubaoCaptureConfig) return;

  window.doubaoCaptureConfig = {
    name: 'doubao',
    action: 'doubaoCopyCapture',

    // ============= 复制按钮 =============
    // 豆包在 assistant 消息底部有一个 [data-foundation-type="receive-message-action-bar"] 操作栏，
    // 该栏内有多个按钮（复制、赞、踩等），第一个 button 通常是复制按钮。
    copyBtnPrimarySelector: '[data-foundation-type="receive-message-action-bar"] button:first-child',
    copyBtnSelectors: [
      '[data-foundation-type="receive-message-action-bar"] button:first-child',
      '[data-foundation-type="receive-message-action-bar"] button',
      'button[aria-label*="复制"]',
      'button[aria-label*="Copy"]',
    ],

    // ============= 内容定位 =============
    getContentRoot: function(turnRoot) {
      return turnRoot.querySelector('.flow-markdown-body') ||
             turnRoot.querySelector('.paragraph-pP9ZLC') ||
             turnRoot;
    },

    getConversationId: function() {
      try {
        var url = new URL(window.location.href);
        var parts = url.pathname.split('/').filter(Boolean);
        if (parts[0] === 'chat' && parts[1]) return parts[1];
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var el = element.getAttribute('data-message-id')
        ? element
        : (element.querySelector('[data-message-id]') || element.closest('[data-message-id]'));
      if (el) {
        var mid = el.getAttribute('data-message-id');
        if (mid) return mid;
      }
      return null;
    },

    // ============= 事件检测 =============
    /**
     * 检测目标是否位于 assistant 消息内
     * 豆包用 data-foundation-type="receive-message-action-bar" 标识 assistant 消息的操作栏，
     * 整个消息容器为 div[data-target-id="message-box-target-id"]
     */
    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;

      // 优先：通过 assistant 操作栏往上找到消息容器
      var actionBar = target.closest('[data-foundation-type="receive-message-action-bar"]');
      if (actionBar) {
        return actionBar.closest('[data-target-id="message-box-target-id"]') || actionBar;
      }

      // 兜底：直接命中消息容器
      var turnContainer = target.closest('[data-target-id="message-box-target-id"]');
      if (turnContainer) return turnContainer;

      return null;
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;

      // 在 assistant 操作栏中的按钮都可能是复制目标
      var actionBar = element.closest('[data-foundation-type="receive-message-action-bar"]');
      if (actionBar) {
        if (element.tagName === 'BUTTON' || element.closest('button')) return true;
      }

      var label = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    // ============= 可选 =============
    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH', 'MathJAX']),
    contextWindowMs: 6000,
    debug: true,
  };
})();
