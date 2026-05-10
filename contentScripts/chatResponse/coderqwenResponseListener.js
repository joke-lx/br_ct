/**
 * CoderQwen 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 *
 * NOTE: 此配置未在真实对话页面验证，需要测试后调整。
 */
(function() {
  if (window.__coderqwenResponseListenerInjected) return;
  window.__coderqwenResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[CoderQwen Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'coderqwen',
    hostnames: ['coder.qwen.ai'],

    responseSelectors: [
      '[class*="content"]',
      '[class*="message"]',
      '.markdown-body',
    ],

    turnSelectors: [
      '[class*="turn"]',
      '[class*="message"]',
      '[class*="chat-item"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'coderqwenCaptureConfig',

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var turn = element.closest('[class*="turn"], [class*="message"], [class*="chat-item"]');
      if (turn) {
        if (!turn.dataset.testid) {
          window.__coderqwenTurnSeq = (window.__coderqwenTurnSeq || 0) + 1;
          turn.dataset.testid = 'coderqwen-turn-' + window.__coderqwenTurnSeq + '-' + Date.now();
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
