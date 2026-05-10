/**
 * 元宝 (Yuanbao) 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 */
(function() {
  if (window.__yuanbaoResponseListenerInjected) return;
  window.__yuanbaoResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[Yuanbao Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'yuanbao',
    hostnames: ['yuanbao.tencent.com'],

    // 元宝回复内容在 .hyc-content-md 或 .agent-chat__bubble__content 中
    responseSelectors: [
      '.hyc-content-md',
      '.hyc-content-text',
      '.agent-chat__bubble__content',
    ],

    // Turn 容器使用 BEM 类名
    turnSelectors: [
      '[class*="agent-chat__list__item"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'yuanbaoCaptureConfig',

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var turn = element.closest('[class*="agent-chat__list__item"]');
      if (turn) {
        if (!turn.dataset.testid) {
          window.__yuanbaoTurnSeq = (window.__yuanbaoTurnSeq || 0) + 1;
          turn.dataset.testid = 'yuanbao-turn-' + window.__yuanbaoTurnSeq + '-' + Date.now();
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
