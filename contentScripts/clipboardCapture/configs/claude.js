/**
 * Claude 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 */
(function() {
  if (window.claudeCaptureConfig) return;

  window.claudeCaptureConfig = {
    name: 'claude',
    action: 'claudeCopyCapture',

    // ============= 复制按钮 =============
    copyBtnPrimarySelector: 'button[data-testid="action-bar-copy"]',
    copyBtnSelectors: [
      'button[data-testid="action-bar-copy"]',
      'button[aria-label*="Copy"]',
      'button[aria-label*="复制"]',
      'button[aria-label*="copy"]',
    ],

    // ============= 内容定位 =============
    getContentRoot: function(turnRoot) {
      // claude.ai 回复内容在 div.contents 中的最后一个 div.group 内
      var groups = turnRoot.querySelectorAll('div.group');
      for (var i = groups.length - 1; i >= 0; i--) {
        var textEl = groups[i].querySelector('.whitespace-pre-wrap') ||
                     groups[i].querySelector('[class*="font-claude"]');
        if (textEl) return textEl;
        return groups[i];
      }
      return turnRoot;
    },

    getConversationId: function() {
      try {
        var parts = window.location.pathname.split('/').filter(Boolean);
        if (parts[0] === 'chat' && parts[1]) return parts[1];
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      // 设置唯一的 data-testid 用于复制按钮作用域定位
      if (!element.dataset.testid) {
        window.__claudeTurnSeq = (window.__claudeTurnSeq || 0) + 1;
        element.dataset.testid = 'claude-turn-' + window.__claudeTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    // ============= 事件检测 =============
    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      // div.contents 包裹每一轮对话
      var turn = target.closest('div.contents');
      if (turn) return turn;
      return null;
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      if (element.closest('button[data-testid="action-bar-copy"]')) return true;
      var label = [
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    // ============= 可选 =============
    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),
    contextWindowMs: 2500,
    debug: true,
  };
})();
