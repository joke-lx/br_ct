/**
 * ChatGPT 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 */
(function() {
  if (window.chatgptCaptureConfig) return;

  window.chatgptCaptureConfig = {
    name: 'chatgpt',
    action: 'chatgptCopyCapture',

    // ============= 复制按钮 =============
    copyBtnPrimarySelector: 'button[data-testid="copy-turn-action-button"]',
    copyBtnSelectors: [
      'button[data-testid="copy-turn-action-button"]',
      'button[aria-label*="复制回复"]',
      'button[aria-label*="Copy"]',
    ],

    // ============= 内容定位 =============
    getContentRoot: function(turnRoot) {
      return turnRoot.querySelector('[data-message-content]') ||
             turnRoot.querySelector('.markdown') ||
             turnRoot.querySelector('.prose') ||
             turnRoot;
    },

    getConversationId: function() {
      try {
        var url = new URL(window.location.href);
        var parts = url.pathname.split('/').filter(Boolean);
        var idx = parts.indexOf('c');
        if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
        if (parts[0] === 'chat' && parts[1]) return parts[1];
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var testId = element.getAttribute('data-testid');
      if (testId) {
        var m = testId.match(/conversation-turn-(\d+)/);
        if (m) return m[1];
      }
      var parent = element.closest('[data-testid^="conversation-turn-"]');
      if (parent) {
        var m = parent.getAttribute('data-testid').match(/conversation-turn-(\d+)/);
        if (m) return m[1];
      }
      return null;
    },

    // ============= 事件检测 =============
    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      var selectors = [
        '[data-testid^="conversation-turn-"][data-message-author-role="assistant"]',
        '[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
        '[data-message-author-role="assistant"]',
      ];
      for (var i = 0; i < selectors.length; i++) {
        var turn = target.closest(selectors[i]);
        if (turn) return turn;
      }
      return null;
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      if (element.closest('[data-testid="copy-turn-action-button"]')) return true;
      var label = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    // ============= 可选 =============
    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH', 'MathJAX']),
    contextWindowMs: 2500,
    debug: true,
  };
})();
