/**
 * Gemini 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 */
(function() {
  if (window.__geminiResponseListenerInjected) return;
  window.__geminiResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[Gemini Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'gemini',
    hostnames: ['gemini.google.com'],

    responseSelectors: [
      'structured-content-container.model-response-text',
      'structured-content-container',
      '.markdown.markdown-main-panel',
    ],

    turnSelectors: [
      'model-response',
      'structured-content-container',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH', 'MathJAX']),

    captureConfig: 'geminiCaptureConfig',

    getConversationId: function() {
      try {
        var url = new URL(window.location.href);
        var parts = url.pathname.split('/').filter(Boolean);
        if (parts[0] === 'app' && parts[1]) return parts[1];
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var msgContent = element.querySelector('message-content[id^="message-content-id-"]');
      if (msgContent) {
        var id = msgContent.getAttribute('id');
        if (id) return id.replace('message-content-id-', '');
      }
      return null;
    },

    isGenerating: function() {
      // Gemini 生成中会有一个停止按钮
      var stopBtn = document.querySelector('button[aria-label*="stop"], button[aria-label*="停止"]');
      if (stopBtn && !stopBtn.disabled) return true;
      return false;
    },
  });
})();
