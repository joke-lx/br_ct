/**
 * Notion AI 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 已验证：2026-05-10，已登录状态，对话页面可正常使用。
 *
 * DOM 结构特征：
 * - Notion 使用块编辑器（block editor），整个对话渲染为单个 Notion 页面
 * - 没有 per-turn 的 DOM 分隔！所有消息在 .layout-content 内
 * - 内容通过 [data-content-editable-leaf] 块渲染
 * - 复制按钮为 div[role="button"]（非 button 元素），aria-label="Copy response" / "Copy text"
 * - 用户消息有 data-agent-chat-user-step-id 属性
 * - 页面 URL 使用 ?t={UUID} 查询参数
 */
(function() {
  if (window.notionaiCaptureConfig) return;

  window.notionaiCaptureConfig = {
    name: 'notionai',
    action: 'notionaiCopyCapture',

    copyBtnPrimarySelector: '[aria-label="Copy response"]',
    copyBtnSelectors: [
      '[aria-label="Copy response"]',
      '[aria-label="Copy text"]',
      '[aria-label*="copy" i]',
      'div[role="button"][aria-label*="copy" i]',
    ],

    getContentRoot: function(turnRoot) {
      // Notion 无 per-turn 容器，返回 layout-content
      var el = turnRoot.querySelector('[data-content-editable-leaf]') ||
               turnRoot.querySelector('.layout-content') ||
               turnRoot.querySelector('[class*="layout-content"]');
      if (el) return el;
      return turnRoot;
    },

    getConversationId: function() {
      try {
        // URL 格式: /chat?t={UUID}
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
      if (!element.dataset.testid) {
        window.__notionaiTurnSeq = (window.__notionaiTurnSeq || 0) + 1;
        element.dataset.testid = 'notionai-turn-' + window.__notionaiTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      // Notion 无 per-turn 容器，使用 layout-content 作为整个对话的 turn 容器
      return target.closest('.layout-content, [class*="layout-content"], [data-testid^="notionai-turn-"]');
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      var aria = element.getAttribute('aria-label') || '';
      if (/copy|复制/i.test(aria)) return true;
      var label = [
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),
    contextWindowMs: 2500,
    debug: true,
  };
})();
