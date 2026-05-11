/**
 * Google AI Studio 剪贴板捕获配置
 * 通过 chrome.scripting.executeScript 注入，不使用 ES module。
 *
 * 已验证：2026-05-11（DOM 结构确认）
 *
 * ⚠️ 重要限制：AI Studio 以 Angular 虚拟滚动渲染，AI 回复内容不在 DOM 中（.turn-content 始终为 Angular placeholder）。
 * 仅能通过 more_vert 下拉菜单中的 "Copy as text" / "Copy as markdown" 获取内容。
 * 因此 DOM fallback 在此平台无效，只能依赖 execCommand hook（Path C）在用户手动复制时拦截。
 *
 * DOM 结构特征：
 * - Turn 容器: ms-chat-turn#turn-{UUID} > .chat-turn-container.model.render
 * - 复制入口: button[aria-label="Open options"]（more_vert 按钮）→ 打开下拉菜单
 * - 下拉菜单按钮: button.mat-mdc-menu-item（"Copy as text"/"Copy as markdown"）
 * - 内容区: .turn-content（始终为 <!---->，实际内容在 Angular 内部状态中）
 * - turn 有原生 id 属性如 turn-{UUID}
 * - 页面级 toolbar more_vert: aria-label="View more actions"（与 turn 级不同！）
 *
 * 复制流程（两步）：
 *   1) 点击 button[aria-label="Open options"]（more_vert）→ 打开 CDK overlay 下拉菜单
 *   2) 点击菜单项 "Copy as text" 或 "Copy as markdown" → 触发 document.execCommand('copy')
 *   → execCommand hook（Path C）同步拦截，获取纯文本（HTML 为空）
 *
 * 当前 autoCapture 的 simulateCopy 仅执行第 1 步（仅打开菜单），无法自动完成复制。
 * 只能依赖用户手动复制时 execCommand hook 拦截，或 DOM fallback（但此处无效）。
 */
(function() {
  if (window.googlestudioCaptureConfig) return;

  window.googlestudioCaptureConfig = {
    name: 'googlestudio',
    action: 'googlestudioCopyCapture',

    // more_vert 按钮（打开包含复制选项的下拉菜单）
    // ⚠️ 注意：点击此按钮仅打开菜单，不会触发复制。
    // 需要后续点击 "Copy as text" 或 "Copy as markdown" 菜单项。
    copyBtnPrimarySelector: '[aria-label="Open options"]',
    copyBtnSelectors: [
      '[aria-label="Open options"]',
    ],

    getContentRoot: function(turnRoot) {
      var el = turnRoot.querySelector('.turn-content') ||
               turnRoot.querySelector('ms-prompt-chunk') ||
               turnRoot.querySelector('[class*="turn-content"]');
      if (el) return el;
      return turnRoot;
    },

    getConversationId: function() {
      return '__default__';
    },

    getMessageId: function(element) {
      if (!element) return null;
      // 优先使用 ms-chat-turn 的原生 id（turn-{UUID}）
      var turn = element.closest('[class*="chat-turn-container"], ms-chat-turn');
      if (turn && turn.id) return turn.id;
      if (!element.dataset.testid) {
        window.__googlestudioTurnSeq = (window.__googlestudioTurnSeq || 0) + 1;
        element.dataset.testid = 'googlestudio-turn-' + window.__googlestudioTurnSeq + '-' + Date.now();
      }
      return element.dataset.testid;
    },

    detectTurn: function(target) {
      if (!(target instanceof Element)) return null;
      return target.closest('[class*="chat-turn-container"], ms-chat-turn');
    },

    isCopyControl: function(element) {
      if (!(element instanceof Element)) return false;
      // more_vert 按钮（turn 级）
      var aria = element.getAttribute('aria-label') || '';
      if (/options/i.test(aria)) return true;
      // 下拉菜单中的 copy 菜单项
      if (/copy/i.test(aria)) return true;
      // 菜单项文本（无 aria-label）
      var label = [
        element.getAttribute('title'),
        element.textContent,
      ].filter(Boolean).join(' ').toLowerCase();
      return /copy|复制/.test(label);
    },

    skipDomFallback: true, // Angular 虚拟滚动：内容不在 DOM 中，跳过 DOM 兜底
    skipTags: new Set(['BUTTON', 'SCRIPT', 'STYLE', 'SVG', 'PATH']),
    contextWindowMs: 6000,
    debug: true,
  };
})();
