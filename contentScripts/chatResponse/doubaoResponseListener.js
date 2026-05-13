/**
 * 豆包 (Doubao) 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 */
(function() {
  if (window.__doubaoResponseListenerInjected) return;
  window.__doubaoResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[Doubao Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'doubao',
    hostnames: ['doubao.com'],

    responseSelectors: [
      '[data-target-id="message-box-target-id"][data-message-role="assistant"]',
      '[data-target-id="message-box-target-id"]',
    ],

    turnSelectors: [
      '[data-target-id="message-box-target-id"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH', 'MathJAX']),

    captureConfig: 'doubaoCaptureConfig',

    settleTimeMs: 1500,

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

    isGenerating: function() {
      if (window.__doubaoLastSendTime && Date.now() - window.__doubaoLastSendTime < 3000) {
        return true;
      }
      var stopBtn = document.querySelector('[data-testid="stop-generation-button"]') ||
                    document.querySelector('.stop-generation-btn') ||
                    document.querySelector('button[aria-label*="Stop" i]') ||
                    document.querySelector('button[aria-label*="停止" i]') ||
                    document.querySelector('button[id*="stop" i]');
      if (stopBtn && !stopBtn.disabled) return true;
      return false;
    },
  });
})();
