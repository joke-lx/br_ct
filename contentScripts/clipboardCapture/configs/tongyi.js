/**
 * 通义 (Tongyi/Qwen) 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 已验证：2026-05-10，已登录状态可正常使用对话。
 *
 * DOM 结构特征：
 * - Turn 容器: div.chat-round（含 data-chat 属性）
 * - 用户消息: .chat-question-wrap > .chat-question-card-wrap > .question-text-card
 *   toolbar: div.qs-bottom-icon (依次为编辑、复制、删除)，复制是第 2 个
 * - AI 回复: .chat-answers-card-wrap > .answer-common-card
 *   markdown: .markdown-pc-special-class
 *   toolbar: div 级 hover:bg-tag 图标（赞/踩/重新生成/更多）
 *   ⚠️ AI 回复区域没有复制按钮！只有用户消息区域有复制按钮
 * - 复制按钮: div（非 button），内嵌 SVG，clipPath id="copy_svg__a"
 * - 所有工具图标无 aria-label，无 title，textContent 为空（纯 SVG）
 */
(function() {
  if (window.tongyiCaptureConfig) return;

  window.tongyiCaptureConfig = {
    name: 'tongyi',
    action: 'tongyiCopyCapture',

    // AI 回复区域没有复制按钮，留空强制走 DOM fallback
    copyBtnPrimarySelector: '',
    copyBtnSelectors: [''],

    // 将复制按钮搜索限定在 AI 回复区域，避免误点用户消息的复制按钮
    getCopyBtnRoot: function(turnRoot) {
      var answerArea = turnRoot.querySelector('.chat-answers-card-wrap');
      if (answerArea) return answerArea;
      return turnRoot;
    },

    getContentRoot: function(turnRoot) {
      // 优先 AI 回复的 markdown 容器
      var el = turnRoot.querySelector('.markdown-pc-special-class') ||
               turnRoot.querySelector('.chat-answers-card-wrap') ||
               turnRoot.querySelector('[class*="message-select-content"]') ||
               turnRoot.querySelector('.qk-markdown');
      if (el) return el;
      return turnRoot;
    },

    getConversationId: function() {
      try {
        var chatRound = document.querySelector('.chat-round');
        if (chatRound && chatRound.dataset.chat) return chatRound.dataset.chat;
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      if (!element.dataset.testid) {
        window.__tongyiTurnSeq = (window.__tongyiTurnSeq || 0) + 1;
        element.dataset.testid = 'tongyi-turn-' + window.__tongyiTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      // .chat-round 是 turn 容器，含 data-chat 属性
      return target.closest('.chat-round, [data-chat]');
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      // 检测 clipPath id 含 copy 的 SVG
      var svg = element.tagName === 'svg' ? element : element.querySelector('svg');
      if (svg) {
        var clipPath = svg.querySelector('clipPath[id*="copy"]');
        if (clipPath) return true;
        var use = svg.querySelector('use[href*="copy"]');
        if (use) return true;
      }
      // 检测是否为第 2 个 qs-bottom-icon（始终是复制按钮）
      if (element.classList && element.classList.contains('qs-bottom-icon')) {
        var parent = element.parentElement;
        if (parent) {
          var icons = parent.querySelectorAll(':scope > .qs-bottom-icon');
          for (var i = 0; i < icons.length; i++) {
            if (icons[i] === element && i === 1) return true; // 0=编辑 1=复制
          }
        }
      }
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
