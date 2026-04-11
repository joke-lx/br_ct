/**
 * BindDom 运行时脚本
 *
 * 功能：只负责注册快捷键 + 执行绑定点击
 * 元素拾取由 popup 通过 chrome.scripting.executeScript 主动注入
 */

// ==================== 快捷键监听 ====================

class BindDomShortcut {
  constructor() {
    this._setupListener();
    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById('binddom-styles')) return;
    const style = document.createElement('style');
    style.id = 'binddom-styles';
    style.textContent = `
      .binddom-highlight {
        position: absolute !important;
        border: 2px solid #8b5cf6 !important;
        background: rgba(139, 92, 246, 0.15) !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
      }
      .binddom-tooltip {
        position: fixed !important;
        background: #1f2937 !important;
        color: #fff !important;
        font-size: 12px !important;
        padding: 6px 10px !important;
        border-radius: 6px !important;
        z-index: 2147483648 !important;
        pointer-events: none !important;
        font-family: system-ui, sans-serif !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
      }
    `;
    document.head.appendChild(style);
  }

  _setupListener() {
    document.addEventListener('keydown', async (e) => {
      // 加载快捷键
      const result = await new Promise(r => chrome.storage.local.get('binddom.shortcut', r));
      const s = result['binddom.shortcut'];
      if (!s) return;

      const ctrlMatch = s.ctrlKey === e.ctrlKey;
      const altMatch = s.altKey === e.altKey;
      const shiftMatch = s.shiftKey === e.shiftKey;
      const metaMatch = s.metaKey === e.metaKey;
      const keyMatch = s.key.toLowerCase() === e.key.toLowerCase();

      if (ctrlMatch && altMatch && shiftMatch && metaMatch && keyMatch) {
        e.preventDefault();
        e.stopPropagation();
        this._executeBinding();
      }
    });
  }

  async _executeBinding() {
    const config = await new Promise(r => chrome.storage.local.get('binddom.bindings', r));
    const bindings = config['binddom.bindings'] || [];
    const currentUrl = window.location.href;
    const currentHost = location.hostname.replace('www.', '');

    // 查找匹配
    const match = bindings.find(b => {
      try {
        const bHost = new URL(b.url).hostname.replace('www.', '');
        return bHost === currentHost || currentUrl.includes(b.url);
      } catch { return false; }
    });

    if (!match) {
      console.log('[BindDom] 没有匹配的绑定');
      return false;
    }

    // 执行点击
    return this._clickElement(match.selector);
  }

  _clickElement(selectorStr) {
    const selectors = this._parseSelectors(selectorStr);
    for (const sel of selectors) {
      let el = null;
      try {
        if (sel.type === 'css') el = document.querySelector(sel.value);
        else if (sel.type === 'xpath') {
          const r = document.evaluate(sel.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          el = r.singleNodeValue;
        } else if (sel.type === 'id') el = document.getElementById(sel.value);
      } catch {}

      if (el && this._isVisible(el)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          el.click();
          console.log('[BindDom] 点击成功:', sel.value);
        }, 100);
        return true;
      }
    }
    console.log('[BindDom] 未找到元素');
    return false;
  }

  _parseSelectors(str) {
    if (!str) return [];
    return str.split(';').map(s => s.trim()).filter(s => s).map(s => {
      const idx = s.indexOf(':');
      if (idx > 0) return { type: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
      return { type: 'css', value: s };
    });
  }

  _isVisible(el) {
    if (!el || !document.body.contains(el)) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
}

// ==================== 消息监听（供 popup 调用） ====================

chrome.runtime.onMessage.addListener((req, _, send) => {
  if (req.action === 'binddom.execute') {
    // 外部触发执行
    new BindDomShortcut()._executeBinding().then(r => send({ success: r }));
    return true;
  }
});

// ==================== 入口 ====================

if (!window.__binddomShortcut) {
  window.__binddomShortcut = new BindDomShortcut();
  console.log('[BindDom] 快捷键监听已启动');
}
