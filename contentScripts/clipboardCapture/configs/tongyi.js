/**
 * 通义 (Tongyi/Qwen) 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * NOTE: 此配置未在真实对话页面验证，需要测试后调整。
 */
(function() {
  if (window.tongyiCaptureConfig) return;

  window.tongyiCaptureConfig = {
    name: 'tongyi',
    action: 'tongyiCopyCapture',

    copyBtnPrimarySelector: 'button[aria-label="复制"]',
    copyBtnSelectors: [
      'button[aria-label="复制"]',
      'button[aria-label="Copy"]',
      '[class*="copy"]',
    ],

    getContentRoot: function(turnRoot) {
      var el = turnRoot.querySelector('[class*="content"]') ||
               turnRoot.querySelector('[class*="message"]') ||
               turnRoot.querySelector('.markdown-body');
      if (el) return el;
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
        window.__tongyiTurnSeq = (window.__tongyiTurnSeq || 0) + 1;
        element.dataset.testid = 'tongyi-turn-' + window.__tongyiTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      return target.closest('[class*="turn"], [class*="message"], [class*="chat-item"]');
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      var label = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),
    contextWindowMs: 2500,
    debug: true,
  };
})();
