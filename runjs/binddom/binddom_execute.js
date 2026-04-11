/**
 * BindDom 执行脚本（注入到页面执行点击）
 * 由 background 命令触发
 */

(function() {
  console.log('[BindDom] 执行脚本已注入');

  // 样式
  const style = document.createElement('style');
  style.textContent = `
    .binddom-highlight {
      position: absolute !important;
      border: 3px solid #22c55e !important;
      background: rgba(34, 197, 94, 0.2) !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
      transition: opacity 0.5s ease-out;
    }
    .binddom-tooltip {
      position: fixed !important;
      left: 50% !important;
      top: 20px !important;
      transform: translateX(-50%) !important;
      background: #22c55e !important;
      color: #fff !important;
      font-size: 14px !important;
      padding: 8px 16px !important;
      border-radius: 8px !important;
      z-index: 2147483648 !important;
      font-family: system-ui, sans-serif !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
      opacity: 1 !important;
      transition: opacity 1s ease-out !important;
    }
  `;
  document.head.appendChild(style);

  // 消息监听
  chrome.runtime.onMessage.addListener((req, _, send) => {
    if (req.action === 'binddom.doClick' && req.selector) {
      const success = clickElement(req.selector);
      send({ success: success });
    }
    return false;
  });

  function clickElement(selectorStr) {
    const selectors = parseSelectors(selectorStr);
    let el = null;
    let usedSelector = null;

    for (const sel of selectors) {
      try {
        if (sel.type === 'css') {
          el = document.querySelector(sel.value);
        } else if (sel.type === 'xpath') {
          const r = document.evaluate(sel.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          el = r.singleNodeValue;
        } else if (sel.type === 'id') {
          el = document.getElementById(sel.value);
        } else if (sel.type === 'jsPath') {
          // jsPath 格式: document.querySelector("...")
          const match = sel.value.match(/document\.querySelector\("([^"]+)"\)/);
          if (match) el = document.querySelector(match[1]);
        }
      } catch (e) {
        console.log('[BindDom] 选择器出错:', sel.value, e.message);
      }

      if (el && isVisible(el)) {
        usedSelector = sel.value;
        break;
      }
      el = null;
    }

    if (!el) {
      console.log('[BindDom] 未找到可见元素');
      return false;
    }

    // 可视化高亮
    showHighlight(el);

    // 点击
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      el.click();
      console.log('[BindDom] 点击成功:', usedSelector);
    }, 100);

    return true;
  }

  function parseSelectors(str) {
    if (!str) return [];
    return str.split(';').map(s => s.trim()).filter(s => s).map(s => {
      const idx = s.indexOf(':');
      if (idx > 0) {
        return { type: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
      }
      return { type: 'css', value: s };
    });
  }

  function isVisible(el) {
    if (!el || !document.body.contains(el)) return false;
    const s = window.getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function showHighlight(el) {
    const rect = el.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'binddom-highlight';
    highlight.style.top = (rect.top + window.scrollY) + 'px';
    highlight.style.left = (rect.left + window.scrollX) + 'px';
    highlight.style.width = rect.width + 'px';
    highlight.style.height = rect.height + 'px';
    document.body.appendChild(highlight);

    const tooltip = document.createElement('div');
    tooltip.className = 'binddom-tooltip';
    tooltip.textContent = '✓ BindDom 点击成功';
    document.body.appendChild(tooltip);

    setTimeout(() => {
      highlight.style.opacity = '0';
      tooltip.style.opacity = '0';
    }, 500);

    setTimeout(() => {
      highlight.remove();
      tooltip.remove();
    }, 1500);
  }

  // 通知 background 脚本已就绪
  console.log('[BindDom] 执行脚本已加载');
})();
