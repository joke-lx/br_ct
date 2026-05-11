/**
 * Notion AI 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 已验证：2026-05-11，CDP 验证 DOM 结构 + clipboard API
 *
 * DOM 结构特征：
 * - Notion 使用块编辑器（block editor），整个对话渲染为单个 Notion 页面
 * - 没有 per-turn 的 DOM 分隔！所有消息在 .layout-content 内
 * - 内容通过 [data-content-editable-leaf] 块渲染（可能渲染为 Notion block 结构）
 * - 复制按钮为 div[role="button"]（非 button 元素）
 * - AI 回复复制: aria-label="拷贝回复"（中文）/ "Copy response"（英文）
 * - 文本片段复制: aria-label="拷贝文本"（中文）/ "Copy text"（英文）
 * - AI 回复操作栏依次为: 拷贝回复 / 保存到私人页面 / 提供正面反馈 / 提供负面反馈
 * - 用户消息操作栏依次为: 编辑消息 / 拷贝文本
 * - 使用 navigator.clipboard.write() —> 路径 A（prototype 替换）
 * - 用户消息有 data-agent-chat-user-step-id 属性
 * - 页面 URL 使用 ?t={UUID} 查询参数
 */
(function() {
  if (window.notionaiCaptureConfig) return;

  window.notionaiCaptureConfig = {
    name: 'notionai',
    action: 'notionaiCopyCapture',

    // 支持中英文 aria-label（Notion 根据浏览器语言自动切换）
    copyBtnPrimarySelector: '[aria-label="拷贝回复"],[aria-label="Copy response"]',
    copyBtnSelectors: [
      '[aria-label="拷贝回复"],[aria-label="Copy response"]',
      '[aria-label="拷贝文本"],[aria-label="Copy text"]',
      '[aria-label*="copy" i]',
      'div[role="button"][aria-label*="copy" i]',
    ],
    // Notion AI 整个对话共用一个 .layout-content，有多个相同 aria-label 的按钮
    // 取最后一个（最新消息）而非第一个
    copyBtnFindLast: true,

    getContentRoot: function(turnRoot) {
      // Notion 块编辑器：取最后一个非空内容块作为 DOM fallback
      // querySelector 取第一个块（用户消息），改为取最后一块（最新 AI 回复）
      var blocks = turnRoot.querySelectorAll('[data-content-editable-leaf]');
      if (blocks.length > 0) {
        for (var i = blocks.length - 1; i >= 0; i--) {
          var t = blocks[i].textContent ? blocks[i].textContent.trim() : '';
          if (t) return blocks[i];
        }
      }
      var el = turnRoot.querySelector('.layout-content') ||
               turnRoot.querySelector('[class*="layout-content"]');
      if (el) return el;
      return turnRoot;
    },

    getConversationId: function() {
      try {
        // URL 格式: /chat?t={UUID}
        var params = new URLSearchParams(window.location.search);
        var t = params.get('t');
        if (t) return t;
        var parts = window.location.pathname.split('/').filter(Boolean);
        return parts[parts.length - 1] || '__default__';
      } catch(e) {}
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      // Notion AI 整个对话共用一个 .layout-content 作为 turn 容器，
      // 不能用固定 testid（否则 dedup 会阻止后续消息的捕获）。
      // 不修改 element.dataset（响应监听器依赖稳定的 testid 做消息去重）。
      window.__notionaiTurnSeq = (window.__notionaiTurnSeq || 0) + 1;
      return 'notionai-turn-' + window.__notionaiTurnSeq + '-' + Date.now();
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      // Notion 无 per-turn 容器，使用 layout-content 作为整个对话的 turn 容器
      return target.closest('.layout-content, [class*="layout-content"], [data-testid^="notionai-turn-"]');
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
    contextWindowMs: 6000,
    debug: true,
  };
})();
