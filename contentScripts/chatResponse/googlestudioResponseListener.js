/**
 * Google AI Studio 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 *
 * NOTE: Google AI Studio 使用 Angular 虚拟滚动，turn 内容需要点击后才能渲染。
 *       复制操作在 more_vert 下拉菜单中，无直接复制按钮。
 *       主要依赖 DOM fallback 提取内容。
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

    // 回复内容在 .turn-content 或 ms-prompt-chunk 中
    responseSelectors: [
      '.turn-content',
      'ms-prompt-chunk',
      'ms-text-chunk',
    ],

    // Turn 容器是 .chat-turn-container
    turnSelectors: [
      '[class*="chat-turn-container"]',
      'ms-chat-turn',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'googlestudioCaptureConfig',

    getConversationId: function() {
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      // 使用原生 id 属性
      if (element.id) return element.id;
      var turn = element.closest('[class*="chat-turn-container"], ms-chat-turn');
      if (turn) {
        if (turn.id) return turn.id;
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
