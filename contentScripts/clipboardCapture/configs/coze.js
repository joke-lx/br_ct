/**
 * Coze 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * NOTE: 未登录无法访问对话页面 (/chat/ 需要登录)，以下选择器基于通用推测，
 * 需要在已登录状态的 Chrome 会话中验证。
 *
 * Coze 技术栈: React + CodeMirror 编辑器
 * 对话页路由: /chat/{id}
 */
(function() {
  if (window.cozeCaptureConfig) return;

  window.cozeCaptureConfig = {
    name: 'coze',
    action: 'cozeCopyCapture',

    copyBtnPrimarySelector: 'button[aria-label*="copy" i]',
    copyBtnSelectors: [
      'button[aria-label*="copy" i]',
      'button[aria-label*="复制"]',
      '[class*="copy-btn"]',
      '[class*="copy"]',
    ],

    getContentRoot: function(turnRoot) {
      var el = turnRoot.querySelector('[class*="message-content"]') ||
               turnRoot.querySelector('[class*="content"]') ||
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
        window.__cozeTurnSeq = (window.__cozeTurnSeq || 0) + 1;
        element.dataset.testid = 'coze-turn-' + window.__cozeTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      return target.closest('[class*="turn"], [class*="message"], [class*="chat-item"]');
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
