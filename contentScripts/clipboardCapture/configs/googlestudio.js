/**
 * Google AI Studio 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 已验证：2026-05-10，已登录状态，对话页面可正常使用。
 *
 * DOM 结构特征：
 * - Angular 虚拟滚动架构，turn 容器: .chat-turn-container
 * - 回复内容在 .turn-content 内的 ms-prompt-chunk > ms-text-chunk > ms-cmark-node
 * - 无直接复制按钮！复制操作在 more_vert 下拉菜单中（"Copy as text"/"Copy as markdown"）
 * - 主要依靠 DOM fallback 提取内容（clipboard write 需要页面 focus）
 * - Turn 元素有 id 属性如 turn-{UUID}
 */
(function() {
  if (window.googlestudioCaptureConfig) return;

  window.googlestudioCaptureConfig = {
    name: 'googlestudio',
    action: 'googlestudioCopyCapture',

    // Google AI Studio 无直接复制按钮，选择器设为不匹配任何元素
    // 复制操作通过 more_vert 下拉菜单完成（"Copy as text"/"Copy as markdown"）
    copyBtnPrimarySelector: '[aria-label="Open options"]',
    copyBtnSelectors: [
      '[aria-label="Open options"]',
    ],

    getContentRoot: function(turnRoot) {
      var el = turnRoot.querySelector('.turn-content') ||
               turnRoot.querySelector('ms-prompt-chunk') ||
               turnRoot.querySelector('[class*="turn-content"]');
      if (el) return el;
      return turnRoot;
    },

    getConversationId: function() {
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      // 使用 ms-prompt-chunk 或 ms-chat-turn 的原生 id
      var chunk = element.querySelector('ms-prompt-chunk') || element;
      if (chunk && chunk.id) return chunk.id;
      if (!element.dataset.testid) {
        window.__googlestudioTurnSeq = (window.__googlestudioTurnSeq || 0) + 1;
        element.dataset.testid = 'googlestudio-turn-' + window.__googlestudioTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      return target.closest('[class*="chat-turn-container"], ms-chat-turn');
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      // more_vert 按钮的 aria-label
      var aria = element.getAttribute('aria-label') || '';
      if (/options|more/i.test(aria)) return true;
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
