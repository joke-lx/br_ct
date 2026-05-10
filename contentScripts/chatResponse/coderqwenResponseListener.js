/**
 * CoderQwen 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 *
 * NOTE: CoderQwen 是代码代理工具，输出以代码 diff 为主。
 *       页面中无复制按钮（只有赞/踩/重新生成），
 *       复制功能需通过 DOM fallback 实现。
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

    // CoderQwen 回复内容在 .response-message-content 中
    responseSelectors: [
      '.response-message-content',
      '.user-message-content',
      '.qwen-markdown',
    ],

    // Turn 容器
    turnSelectors: [
      '.chat-user-message-container',
      '.chat-response-message',
      '[class*="response-message"]',
      '[class*="user-message"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'coderqwenCaptureConfig',

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        if (parts[0] === 'c' && parts[1]) return parts[1];
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var turn = element.closest('.chat-user-message-container, .chat-response-message, [class*="response-message"], [class*="user-message"]');
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
