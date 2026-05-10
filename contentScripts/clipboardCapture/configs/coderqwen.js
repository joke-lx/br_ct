/**
 * CoderQwen 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 已验证：2026-05-10，已登录状态，对话页可正常使用。
 *
 * DOM 结构特征：
 * - React + Ant Design v5 + Monaco Editor
 * - 对话路由: /c/{uuid}
 * - 用户消息: .chat-user-message-container > p.whitespace-pre-wrap.user-message-content.fade-in
 * - AI 回复: .chat-response-message > .response-message-content
 * - Markdown: .qwen-markdown.qwen-markdown-loose（非 .markdown-body）
 * - Turn 容器是无名 DIV，无可用类名
 * - ⚠️ 无复制按钮！操作按钮只有赞、踩、重新生成，没有复制功能
 * - 剪贴板捕获主要依赖 DOM fallback 提取内容
 */
(function() {
  if (window.coderqwenCaptureConfig) return;

  window.coderqwenCaptureConfig = {
    name: 'coderqwen',
    action: 'coderqwenCopyCapture',

    // CoderQwen 无复制按钮，设置为空选择器
    // 复制功能通过 DOM fallback 实现
    copyBtnPrimarySelector: '',
    copyBtnSelectors: [
      '',
    ],

    getContentRoot: function(turnRoot) {
      var el = turnRoot.querySelector('.response-message-content') ||
               turnRoot.querySelector('.user-message-content') ||
               turnRoot.querySelector('.qwen-markdown.qwen-markdown-loose') ||
               turnRoot.querySelector('.qwen-markdown') ||
               turnRoot.querySelector('[class*="message-content"]');
      if (el) return el;
      return turnRoot;
    },

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
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
      // Turn 容器是无名 DIV，回退到消息容器
      return target.closest('.chat-user-message-container, .chat-response-message, [class*="response-message"], [class*="user-message"]');
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
