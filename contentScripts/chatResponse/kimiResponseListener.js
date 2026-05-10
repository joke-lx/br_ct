/**
 * Kimi 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 *
 * 注意：此配置基于 Kimi 通用 DOM 模式，建议在实际使用中验证选择器。
 */
(function() {
  if (window.__kimiResponseListenerInjected) return;
  window.__kimiResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[Kimi Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'kimi',
    hostnames: ['kimi.moonshot.cn'],

    responseSelectors: [
      '[class*="message-content"]',
      '[class*="chat-message"]',
    ],

    turnSelectors: [
      '[class*="conversation-turn"]',
      '[class*="message-item"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'kimiCaptureConfig',

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var turn = element.closest('[class*="conversation-turn"], [class*="message-item"]');
      if (turn) {
        if (!turn.dataset.testid) {
          window.__kimiTurnSeq = (window.__kimiTurnSeq || 0) + 1;
          turn.dataset.testid = 'kimi-turn-' + window.__kimiTurnSeq + '-' + Date.now();
        }
        return turn.dataset.testid;
      }
      return null;
    },

    isGenerating: function() {
      var stopBtn = document.querySelector('button[aria-label*="Stop"]') ||
                    document.querySelector('button[aria-label*="停止"]');
      if (stopBtn && !stopBtn.disabled) return true;
      return false;
    },
  });
})();
