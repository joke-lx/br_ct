/**
 * Claude 回复监听模块
 *
 * 通过 chrome.scripting.executeScript 注入，使用 IIFE + window.* 全局通信。
 * 依赖：ResponseListenerCore（core.js 中定义）
 */
(function() {
  if (window.__claudeResponseListenerInjected) return;
  window.__claudeResponseListenerInjected = true;

  if (!window.ResponseListenerCore) {
    console.warn('[Claude Response Listener] ResponseListenerCore not found');
    return;
  }

  window.ResponseListenerCore.createResponseListener({
    platform: 'claude',
    hostnames: ['claude.ai'],

    // div.contents 包裹每一轮对话（用户消息 + 助手回复）
    // ⚠️ 不能只用 div.contents：Claude.ai 在对话区域外还有一个 div.contents.print:hidden（Share 头部），
    // querySelectorAll 返回的最后一个 div.contents 会是这个头部而非最新的 AI 回复。
    // 必须限定为 div.group div.contents（仅对话回合内的内容容器）。
    responseSelectors: [
      'div.group div.contents',
      'div.contents',
    ],

    turnSelectors: [
      'div.contents',
    ],

    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),

    getRole: function(container) {
      // Assistant 消息有 .whitespace-pre-wrap 或 font-claude 样式
      if (container.querySelector('.whitespace-pre-wrap, [class*="font-claude"]')) {
        return 'assistant';
      }
      // User 消息可以从 div.group 内部特征推断
      if (container.querySelector('textarea, [contenteditable="true"]') ||
          container.closest('[data-testid="user-message"]')) {
        return 'user';
      }
      return null;
    },

    captureConfig: 'claudeCaptureConfig',

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        if (parts[0] === 'chat' && parts[1]) return parts[1];
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      // 确保 div.contents 上有 data-testid，供 autoCapture 作用域定位使用
      if (!element.dataset.testid) {
        window.__claudeTurnSeq = (window.__claudeTurnSeq || 0) + 1;
        element.dataset.testid = 'claude-turn-' + window.__claudeTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    isGenerating: function() {
      // Claude 生成中会在输入区显示停止按钮
      var stopBtn = document.querySelector('button[aria-label*="Stop"]') ||
                    document.querySelector('button[aria-label*="stop"]');
      if (stopBtn && !stopBtn.disabled) return true;
      return false;
    },
  });
})();
