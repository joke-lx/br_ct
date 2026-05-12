/**
 * Google AI Studio 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 *
 * ⚠️ 重要限制：AI Studio 使用 Angular 虚拟滚动，.turn-content 始终为 Angular placeholder（<!---->），
 *    AI 回复内容不在 DOM 中。responseSelectors 实际上不会检测到新的回复内容，
 *    因此 autoCapture 可能不会被触发。
 *
 * 复制操作在 more_vert 下拉菜单中（"Copy as text"/"Copy as markdown"），无直接复制按钮。
 * 内容只能通过 execCommand hook（Path C）在用户手动复制时拦截。
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

    // Angular 虚拟滚动流式输出时内容逐渐填充，等 1.5s 无变化后才触发捕获
    settleTimeMs: 1500,

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
