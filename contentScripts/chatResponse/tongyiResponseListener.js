/**
 * 通义 (Tongyi) 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 */
(function() {
  if (window.__tongyiResponseListenerInjected) return;
  window.__tongyiResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[Tongyi Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'tongyi',
    hostnames: ['www.qianwen.com', 'tongyi.aliyun.com'],

    // 通义回复在 .markdown-pc-special-class 或 .chat-answers-card-wrap 中
    responseSelectors: [
      '.markdown-pc-special-class',
      '.chat-answers-card-wrap',
      '.chat-question-card-wrap',
    ],

    // Turn 容器是 .chat-round（含 data-chat 属性）
    turnSelectors: [
      '.chat-round',
      '[data-chat]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'tongyiCaptureConfig',

    getConversationId: function() {
      try {
        var chatRound = document.querySelector('.chat-round');
        if (chatRound && chatRound.dataset.chat) return chatRound.dataset.chat;
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var turn = element.closest('.chat-round, [data-chat]');
      if (turn) {
        if (!turn.dataset.testid) {
          window.__tongyiTurnSeq = (window.__tongyiTurnSeq || 0) + 1;
          turn.dataset.testid = 'tongyi-turn-' + window.__tongyiTurnSeq + '-' + Date.now();
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
