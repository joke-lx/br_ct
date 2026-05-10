/**
 * Grok 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 */
(function() {
  if (window.__grokResponseListenerInjected) return;
  window.__grokResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[Grok Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'grok',
    hostnames: ['grok.com'],

    // Grok 每条回复的文本内容在 message-bubble 中
    responseSelectors: [
      'div.message-bubble',
    ],

    // Turn（完整回复容器）选择器，用于 autoCapture 定位操作栏中的复制按钮
    turnSelectors: [
      '[class*="group"][class*="flex-col"][class*="justify-center"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'grokCaptureConfig',

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        // URL 格式: /c/<conversation-id>
        if (parts[0] === 'c' && parts[1]) return parts[1];
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      // 从 message-bubble 向上找到 assistant turn 容器
      var turn = element.closest('[class*="group"][class*="flex-col"][class*="justify-center"]');
      if (turn) {
        if (!turn.dataset.testid) {
          window.__grokTurnSeq = (window.__grokTurnSeq || 0) + 1;
          turn.dataset.testid = 'grok-turn-' + window.__grokTurnSeq + '-' + Date.now();
        }
        return turn.dataset.testid;
      }
      return null;
    },

    isGenerating: function() {
      // Grok 生成中通常有停止按钮
      var stopBtn = document.querySelector('button[aria-label*="Stop"]') ||
                    document.querySelector('button[aria-label*="stop"]') ||
                    document.querySelector('button[aria-label*="停止"]');
      if (stopBtn && !stopBtn.disabled) return true;
      return false;
    },
  });
})();
