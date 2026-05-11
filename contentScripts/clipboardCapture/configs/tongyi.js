/**
 * 通义 (Tongyi/Qwen) 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 已验证：2026-05-11，CDP 验证 DOM 结构 + clipboard API
 *
 * DOM 结构特征（历史对话页面）：
 * - URL 模式: /chat/{conversationId}
 * - Turn 容器: div.chat-round（含 data-chat 属性）
 * - 用户消息: .chat-question-wrap > .chat-question-card-wrap > .question-text-card
 *   toolbar: div.qs-bottom-icon (依次为编辑、复制、删除)，复制是第 2 个
 * - AI 回复: .chat-answers-card-wrap > .answer-common-card
 *   markdown: .markdown-pc-special-class > .qk-markdown
 *   toolbar: div.flex.items-center.gap-2 含多个 hover:bg-tag 图标按钮
 *     第 1 个是复制按钮（div.hover:bg-tag.cursor-pointer + 下拉箭头按钮）
 *     后续依次是 赞/踩/重新生成/更多
 * - 复制按钮: div（非 button），内嵌 SVG，含抄送图标 path d="M832 64..."
 * - 用户消息的复制按钮使用 clipPath id="copy_svg__a"
 * - AI 回复的复制按钮使用内联 SVG path（无 clipPath）
 * - 所有工具图标无 aria-label，无 title，textContent 为空（纯 SVG）
 * - 使用 navigator.clipboard.write() —> 路径 A（prototype 替换）
 *
 * 欢迎页/新对话结构（qqianwen.com/#）：
 * - wrapper-Yv2YGq > chatRoom-rNZG_v > chat-room-outer-wrap > chat-container-wrapper
 * - AI 欢迎语 "你好，我是千问" 无操作栏（无复制按钮）
 * - 发送消息后 AI 回复会进入 chat-round 结构（同上）
 */
(function() {
  if (window.tongyiCaptureConfig) return;

  window.tongyiCaptureConfig = {
    name: 'tongyi',
    action: 'tongyiCopyCapture',

    // AI 回复工具栏复制按钮：第一个 cursor-pointer 元素（24x24 图标 div）
    // querySelector 返回 DOM 顺序的第一个匹配
    copyBtnPrimarySelector: '[class*="cursor-pointer"]',
    copyBtnSelectors: [
      '[class*="cursor-pointer"]',
    ],

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
      // 1) AI 回复复制按钮：检测 SVG 抄送图标 path（d 以 "M832 64" 开头）
      var svg = element.tagName === 'svg' ? element : element.querySelector('svg');
      if (svg) {
        var path = svg.querySelector('path[d^="M832 64"]');
        if (path) return true;
        // 2) 用户消息复制按钮：clipPath id 含 copy
        var clipPath = svg.querySelector('clipPath[id*="copy"]');
        if (clipPath) return true;
        var use = svg.querySelector('use[href*="copy"]');
        if (use) return true;
      }
      // 3) 检测是否为第 2 个 qs-bottom-icon（用户消息复制按钮的 class 检测）
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
    contextWindowMs: 6000,
    debug: true,
  };
})();
