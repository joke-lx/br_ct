/**
 * Notion AI 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 *
 * NOTE: Notion AI 的 DOM 结构复杂，此配置为最佳估计，需要验证。
 */
(function() {
  if (window.__notionaiResponseListenerInjected) return;
  window.__notionaiResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[NotionAI Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'notionai',
    hostnames: ['www.notion.so'],

    responseSelectors: [
      '[class*="content"]',
      '.notion-ai-content',
    ],

    turnSelectors: [
      '[class*="turn"]',
      '[class*="message"]',
      '[class*="ai-response"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'notionaiCaptureConfig',

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var turn = element.closest('[class*="turn"], [class*="message"], [class*="ai-response"]');
      if (turn) {
        if (!turn.dataset.testid) {
          window.__notionaiTurnSeq = (window.__notionaiTurnSeq || 0) + 1;
          turn.dataset.testid = 'notionai-turn-' + window.__notionaiTurnSeq + '-' + Date.now();
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
