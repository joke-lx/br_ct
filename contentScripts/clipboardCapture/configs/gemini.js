/**
 * Gemini 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 */
(function() {
  if (window.geminiCaptureConfig) return;

  window.geminiCaptureConfig = {
    name: 'gemini',
    action: 'geminiCopyCapture',

    // ============= 复制按钮 =============
    copyBtnPrimarySelector: 'button[data-test-id="copy-button"]',
    copyBtnSelectors: [
      'button[data-test-id="copy-button"]',
      'copy-button button',
      'button[aria-label="复制"]',
      'button[aria-label="Copy"]',
    ],

    // ============= 内容定位 =============
    getContentRoot: function(turnRoot) {
      return turnRoot.querySelector('.markdown.markdown-main-panel') ||
             turnRoot.querySelector('structured-content-container') ||
             turnRoot.querySelector('.model-response-text') ||
             turnRoot;
    },

    getConversationId: function() {
      try {
        var url = new URL(window.location.href);
        var parts = url.pathname.split('/').filter(Boolean);
        if (parts[0] === 'app' && parts[1]) return parts[1];
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      // 尝试从 message-content id 提取
      var msgContent = element.querySelector('message-content[id^="message-content-id-"]');
      if (msgContent) {
        var id = msgContent.getAttribute('id');
        if (id) {
          var mid = id.replace('message-content-id-', '');
          element.dataset.testid = 'gemini-turn-' + mid;
          return mid;
        }
      }
      // 兜底：确保 data-testid 始终设置
      if (!element.dataset.testid) {
        element.dataset.testid = 'gemini-turn-' + Date.now();
      }
      return null;
    },

    // ============= 事件检测 =============
    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;

      // 优先：通过 copy-button 或 structured-content-container 定位到 model-response（包含内容+操作栏的完整 turn）
      var copyBtn = target.closest('copy-button');
      if (copyBtn) {
        return copyBtn.closest('model-response') || copyBtn.closest('[class*="response"]') || copyBtn;
      }

      // 通过消息内容容器定位
      var contentContainer = target.closest('structured-content-container');
      if (contentContainer) return contentContainer.closest('model-response') || contentContainer;

      var msgContent = target.closest('message-content');
      if (msgContent) return msgContent.closest('model-response') || msgContent;

      return null;
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      if (element.closest('button[data-test-id="copy-button"]')) return true;
      if (element.closest('copy-button')) return true;
      var label = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    // ============= 可选 =============
    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH', 'MathJAX']),
    contextWindowMs: 2500,
    debug: true,
  };
})();
