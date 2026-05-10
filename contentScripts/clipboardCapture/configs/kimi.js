/**
 * Kimi 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 注意：此配置基于 Kimi 通用 DOM 模式，可能需要根据实际页面结构调整。
 */
(function() {
  if (window.kimiCaptureConfig) return;

  window.kimiCaptureConfig = {
    name: 'kimi',
    action: 'kimiCopyCapture',

    // ============= 复制按钮 =============
    copyBtnPrimarySelector: 'button[aria-label="复制"]',
    copyBtnSelectors: [
      'button[aria-label="复制"]',
      'button[aria-label="Copy"]',
      'button[class*="copy"]',
      '[class*="copy-btn"]',
    ],

    // ============= 内容定位 =============
    getContentRoot: function(turnRoot) {
      var contentEl = turnRoot.querySelector('[class*="message-content"]') ||
                      turnRoot.querySelector('[class*="content"]') ||
                      turnRoot.querySelector('.markdown-body');
      if (contentEl) return contentEl;
      return turnRoot;
    },

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      if (!element.dataset.testid) {
        window.__kimiTurnSeq = (window.__kimiTurnSeq || 0) + 1;
        element.dataset.testid = 'kimi-turn-' + window.__kimiTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    // ============= 事件检测 =============
    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      var turn = target.closest('[class*="conversation-turn"]') ||
                 target.closest('[class*="message-item"]') ||
                 target.closest('[class*="chat-message"]');
      if (turn) return turn;
      return null;
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      if (element.closest('button[aria-label="复制"]')) return true;
      if (element.closest('[class*="copy-btn"]')) return true;
      var label = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    // ============= 可选 =============
    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),
    contextWindowMs: 2500,
    debug: true,
  };
})();
