/**
 * Notion AI 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 *
 * NOTE: Notion AI 使用块编辑器，整个对话渲染为单个 Notion 页面。
 *       没有 per-turn 的 DOM 分隔，所有消息在 .layout-content 内。
 *       复制按钮为 div[role="button"]（非 button），aria-label="Copy response"。
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

    // 回复内容在 [data-content-editable-leaf] 块中
    responseSelectors: [
      '[data-content-editable-leaf]',
      '.layout-content',
    ],

    // 整个对话页面作为一个 turn 容器
    turnSelectors: [
      '.layout-content',
      '[class*="layout-content"]',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    captureConfig: 'notionaiCaptureConfig',

    getConversationId: function() {
      try {
        var params = new URLSearchParams(window.location.search);
        var t = params.get('t');
        if (t) return t;
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      var turn = element.closest('.layout-content, [class*="layout-content"]');
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
