/**
 * Google AI Studio 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * NOTE: 此配置未在真实对话页面验证，需要测试后调整。
 */
(function() {
  if (window.googlestudioCaptureConfig) return;

  window.googlestudioCaptureConfig = {
    name: 'googlestudio',
    action: 'googlestudioCopyCapture',

    copyBtnPrimarySelector: 'button[aria-label*="copy" i]',
    copyBtnSelectors: [
      'button[aria-label*="copy" i]',
      'button[aria-label*="复制"]',
      '[class*="copy"]',
    ],

    getContentRoot: function(turnRoot) {
      var el = turnRoot.querySelector('[class*="output"]') ||
               turnRoot.querySelector('[class*="response"]') ||
               turnRoot.querySelector('.markdown');
      if (el) return el;
      return turnRoot;
    },

    getConversationId: function() {
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      if (!element.dataset.testid) {
        window.__googlestudioTurnSeq = (window.__googlestudioTurnSeq || 0) + 1;
        element.dataset.testid = 'googlestudio-turn-' + window.__googlestudioTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      return target.closest('[class*="turn"], [class*="message"], [class*="response"]');
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      var aria = element.getAttribute('aria-label') || '';
      if (/copy|复制/i.test(aria)) return true;
      var label = [
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
