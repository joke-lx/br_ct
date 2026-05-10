/**
 * Notion AI 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * NOTE: Notion AI 的 DOM 结构复杂，此配置为最佳估计，需要验证。
 */
(function() {
  if (window.notionaiCaptureConfig) return;

  window.notionaiCaptureConfig = {
    name: 'notionai',
    action: 'notionaiCopyCapture',

    copyBtnPrimarySelector: 'button[aria-label*="copy" i]',
    copyBtnSelectors: [
      'button[aria-label*="copy" i]',
      'button[aria-label*="复制"]',
      '[class*="copy"]',
    ],

    getContentRoot: function(turnRoot) {
      var el = turnRoot.querySelector('[class*="content"]') ||
               turnRoot.querySelector('.notion-ai-content');
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
        window.__notionaiTurnSeq = (window.__notionaiTurnSeq || 0) + 1;
        element.dataset.testid = 'notionai-turn-' + window.__notionaiTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      return target.closest('[class*="turn"], [class*="message"], [class*="ai-response"]');
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
