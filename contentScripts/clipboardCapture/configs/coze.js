/**
 * Coze 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 已验证：2026-05-10，已登录状态，对话页可正常使用。
 *
 * DOM 结构特征：
 * - React + Semi UI (字节跳动 UI 框架) + CodeMirror
 * - Turn 容器: [class*="message-item"]，带 data-message-id 属性
 * - AI 回复内容: .flow-markdown-body 或 .message-jIHrwV
 * - 复制按钮: svg.lucide-copy（非 button，aria-hidden="true"），点击通过 onclick 绑定在 SVG 上
 * - 用户消息有乐观渲染（message-item-start-*）和确认后（message-item-*）两个版本
 */
(function() {
  if (window.cozeCaptureConfig) return;

  window.cozeCaptureConfig = {
    name: 'coze',
    action: 'cozeCopyCapture',

    copyBtnPrimarySelector: 'svg.lucide-copy',
    copyBtnSelectors: [
      'svg.lucide-copy',
      '.lucide-copy',
      '[class*="copy"]',
    ],

    getContentRoot: function(turnRoot) {
      var el = turnRoot.querySelector('.flow-markdown-body') ||
               turnRoot.querySelector('.message-jIHrwV') ||
               turnRoot.querySelector('.md-viewer') ||
               turnRoot.querySelector('[class*="message-content"]') ||
               turnRoot.querySelector('[class*="content"]');
      if (el) return el;
      return turnRoot;
    },

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      // 优先使用原生 data-message-id
      if (element.dataset.messageId) return element.dataset.messageId;
      var turn = element.closest('[class*="message-item"], [data-message-id]');
      if (turn) {
        if (turn.dataset.messageId) return turn.dataset.messageId;
        if (!turn.dataset.testid) {
          window.__cozeTurnSeq = (window.__cozeTurnSeq || 0) + 1;
          turn.dataset.testid = 'coze-turn-' + window.__cozeTurnSeq + '-' + Date.now();
        }
        return turn.dataset.testid;
      }
      return null;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      return target.closest('[class*="message-item"], [data-message-id], [class*="message"], [class*="chat-item"]');
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      // Coze 复制按钮是 svg.lucide-copy，无 aria-label 无 textContent
      if (element.classList && element.classList.contains('lucide-copy')) return true;
      var svg = element.querySelector('svg.lucide-copy');
      if (svg) return true;
      var cls = element.className || '';
      if (typeof cls === 'string' && /copy/.test(cls)) return true;
      var aria = element.getAttribute('aria-label') || '';
      if (/copy|复制/i.test(aria)) return true;
      var label = [
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    // Coze 复制按钮是 SVG 元素，不能跳过 SVG
    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'PATH']),
    contextWindowMs: 2500,
    debug: true,
  };
})();
