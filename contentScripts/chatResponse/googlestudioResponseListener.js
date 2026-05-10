/**
 * Google AI Studio 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 *
 * NOTE: 此配置未在真实对话页面验证，需要测试后调整。
 */
(function() {
  if (window.__googlestudioResponseListenerInjected) return;
  window.__googlestudioResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[GoogleStudio Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'googlestudio',
    hostnames: ['aistudio.google.com'],

    responseSelectors: [
      '[class*="output"]',
      '[class*="response"]',
      '.markdown',
    ],

    turnSelectors: [
      '[class*="turn"]',
      '[class*="message"]',
      '[class*="response"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'googlestudioCaptureConfig',

    getConversationId: function() {
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var turn = element.closest('[class*="turn"], [class*="message"], [class*="response"]');
      if (turn) {
        if (!turn.dataset.testid) {
          window.__googlestudioTurnSeq = (window.__googlestudioTurnSeq || 0) + 1;
          turn.dataset.testid = 'googlestudio-turn-' + window.__googlestudioTurnSeq + '-' + Date.now();
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
