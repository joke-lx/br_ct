/**
 * ChatGPT 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 */
(function() {
  if (window.__chatgptResponseListenerInjected) return;
  window.__chatgptResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[ChatGPT Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'chatgpt',
    hostnames: ['chatgpt.com', 'chat.openai.com'],

    responseSelectors: [
      '[data-testid^="conversation-turn-"][data-message-author-role="assistant"]',
      '[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
      '[data-message-author-role="assistant"]',
    ],

    turnSelectors: [
      '[data-testid^="conversation-turn-"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH', 'MathJAX']),

    captureConfig: 'chatgptCaptureConfig',

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

    isGenerating: function() {
      return Array.from(document.querySelectorAll('button')).some(function(button) {
        var label = [
          button.getAttribute('aria-label'),
          button.getAttribute('title'),
          button.textContent
        ].filter(Boolean).join(' ').toLowerCase();
        return /stop|stopping|停止|中止/.test(label) &&
          !button.disabled &&
          button.getAttribute('aria-disabled') !== 'true';
      });
    },
  });
})();
