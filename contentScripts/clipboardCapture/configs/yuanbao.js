/**
 * 元宝 (Yuanbao) 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 已验证：2026-05-10，无需登录即可使用对话功能。
 *
 * DOM 结构特征：
 * - Turn 容器: .agent-chat__list__item--ai / --human
 * - AI 回复内容: .hyc-content-md.hyc-content-md-done > .hyc-common-markdown
 * - 用户消息内容: .hyc-content-text
 * - 用户消息复制按钮: div.agent-chat__question-toolbar__copy-wrapper
 *   (内部为 div.ToolbarCopy_copyIconWrap__PfQIm > span.iconfont-yb.icon-yb-ic_copy_2504)
 * - ⚠️ AI 回复区域没有复制按钮（有赞/踩/更多等但无复制）
 * - 复制元素为 div（非 button），无 aria-label，无 textContent
 */
(function() {
  if (window.yuanbaoCaptureConfig) return;

  window.yuanbaoCaptureConfig = {
    name: 'yuanbao',
    action: 'yuanbaoCopyCapture',

    // AI 回复区域没有复制按钮，留空强制走 DOM fallback
    copyBtnPrimarySelector: '',
    copyBtnSelectors: [''],

    // 将复制按钮搜索限定在 AI 回复区域
    getCopyBtnRoot: function(turnRoot) {
      var el = turnRoot.querySelector('.hyc-content-md.hyc-content-md-done') ||
               turnRoot.querySelector('.hyc-common-markdown');
      if (el) return el;
      return turnRoot;
    },

    getContentRoot: function(turnRoot) {
      // 优先 AI 回复的 markdown 容器
      var el = turnRoot.querySelector('.hyc-content-md.hyc-content-md-done') ||
               turnRoot.querySelector('.hyc-common-markdown') ||
               turnRoot.querySelector('.hyc-content-md') ||
               turnRoot.querySelector('.hyc-content-text') ||
               turnRoot.querySelector('.agent-chat__bubble__content');
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
      if (!element.dataset.testid) {
        window.__yuanbaoTurnSeq = (window.__yuanbaoTurnSeq || 0) + 1;
        element.dataset.testid = 'yuanbao-turn-' + window.__yuanbaoTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      // 元宝使用 BEM 类名: agent-chat__list__item--ai / agent-chat__list__item--human
      return target.closest('[class*="agent-chat__list__item"]');
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      // 优先检测 class 名
      var cls = element.className || '';
      if (typeof cls === 'string' && (
          cls.indexOf('copy_wrapper') !== -1 ||
          cls.indexOf('copyIconWrap') !== -1 ||
          cls.indexOf('ic_copy') !== -1)) return true;
      // 向上查找已知的复制按钮容器
      var wrapper = element.closest('.agent-chat__question-toolbar__copy-wrapper');
      if (wrapper) return true;
      // 检查 aria-label
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
