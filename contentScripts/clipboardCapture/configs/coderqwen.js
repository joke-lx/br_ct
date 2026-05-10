/**
 * CoderQwen 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * NOTE: 对话页 (/c/:id) 需要登录才能访问，未登录时重定向到 /auth。
 * 以下选择器从 JS bundle 提取的 React 类名推测，需要登录后验证。
 *
 * 技术栈: React + Ant Design v5
 * 对话页路由: /c/{conversationId}
 * JS bundle 中出现的类名:
 *   - .conversation — 对话条目容器
 *   - .chat-user-message / .qwen-message-content — 消息容器
 *   - .qwen-coder-preview-markdown — markdown 预览
 *   - .copy-btn — 复制按钮
 *   - .qwen-markdown-code-header-actions — 代码块头部操作区（含复制按钮）
 */
(function() {
  if (window.coderqwenCaptureConfig) return;

  window.coderqwenCaptureConfig = {
    name: 'coderqwen',
    action: 'coderqwenCopyCapture',

    copyBtnPrimarySelector: '.copy-btn',
    copyBtnSelectors: [
      '.copy-btn',
      '.qwen-markdown-code-header-actions',
      '[class*="copy-btn"]',
      '[class*="copy"]',
    ],

    getContentRoot: function(turnRoot) {
      var el = turnRoot.querySelector('.qwen-message-content-text') ||
               turnRoot.querySelector('.qwen-message-content') ||
               turnRoot.querySelector('.qwen-coder-preview-markdown') ||
               turnRoot.querySelector('.message-text') ||
               turnRoot.querySelector('.response-message-content');
      if (el) return el;
      return turnRoot;
    },

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        // URL 格式: /c/<conversation-id>
        if (parts[0] === 'c' && parts[1]) return parts[1];
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      if (!element.dataset.testid) {
        window.__coderqwenTurnSeq = (window.__coderqwenTurnSeq || 0) + 1;
        element.dataset.testid = 'coderqwen-turn-' + window.__coderqwenTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      return target.closest('.conversation, .chat-user-message, [class*="message-content"], [class*="qwen-message-content"]');
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      var cls = element.className || '';
      if (typeof cls === 'string' && cls.indexOf('copy-btn') !== -1) return true;
      var wrapper = element.closest('.copy-btn, .qwen-markdown-code-header-actions');
      if (wrapper) return true;
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
