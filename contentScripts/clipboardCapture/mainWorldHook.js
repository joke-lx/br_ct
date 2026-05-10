(function() {
  if (window.__ccCaptureHook) return;
  window.__ccCaptureHook = true;

  console.log('[CC-Hook] loaded');

  // Hook clipboard.write at prototype level
  var proto = Object.getPrototypeOf(navigator.clipboard);
  Object.defineProperty(proto, 'write', {
    value: async function(items) {
      var html = null, text = null;
      for (var i = 0; i < (items || []).length; i++) {
        try { if (items[i].types.includes('text/html')) { var b = await items[i].getType('text/html'); html = await b.text(); } } catch(e) {}
        try { if (items[i].types.includes('text/plain')) { var b = await items[i].getType('text/plain'); text = await b.text(); } } catch(e) {}
      }
      window.postMessage({ source: 'cc-capture-hook', type: 'clipboard-data', payload: { html: html || null, text: text || null, source: 'clipboard.write' } }, '*');
      return Promise.resolve();
    },
    configurable: true, writable: true
  });

  // Hook clipboard.writeText
  Object.defineProperty(proto, 'writeText', {
    value: async function(text) {
      window.postMessage({ source: 'cc-capture-hook', type: 'clipboard-data', payload: { html: null, text: String(text || ''), source: 'clipboard.writeText' } }, '*');
      return Promise.resolve();
    },
    configurable: true, writable: true
  });

  // Hook copy event（捕获阶段 + Selection fallback，拦截 execCommand('copy')）
  document.addEventListener('copy', function(e) {
    try {
      var text = null, html = null;
      try { text = e.clipboardData.getData('text/plain'); } catch(ex) {}
      try { html = e.clipboardData.getData('text/html'); } catch(ex) {}

      // execCommand('copy') 路径：clipboardData.getData 为空，用 Selection fallback
      if (!text && !html) {
        var sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          text = sel.toString() || null;
          try {
            var range = sel.getRangeAt(0);
            var div = document.createElement('div');
            div.appendChild(range.cloneContents());
            html = div.innerHTML || null;
          } catch(ex) {}
        }
      }

      if (text || html) {
        window.postMessage({ source: 'cc-capture-hook', type: 'clipboard-data', payload: { html: html || null, text: text || null, source: 'copy.event' } }, '*');
      }
    } catch(ex) {}
  }, true);

  // Expose simulateCopy for programmatic clicks
  // 用完整鼠标事件序列代替 click()，部分框架（豆包）会检查 isTrusted 忽略纯脚本 click
  window.__ccSimulateCopy = function(btn) {
    if (!(btn instanceof Element)) return false;
    console.log('[CC-Hook] simulateCopy click', btn);

    // Gemini: btn.click() 避免 Angular BardChatUi "No ID or name found in config" 错误
    if (window.location.hostname.indexOf('gemini.google.com') !== -1) {
      btn.focus();
      btn.click();
      return true;
    }

    // 定位最内层元素作为点击目标。某些平台（如元宝）的 onClick 绑定在
    // 内层图标上，dispatchEvent 从外层触发时事件向外冒泡，到不了内层。
    var target = btn;
    var lastChild = target;
    while (lastChild.lastElementChild) {
      lastChild = lastChild.lastElementChild;
    }
    target = lastChild;
    if (target === btn) {
      // 无子元素，取第一个非空子节点作为 fallback
      var leaf = btn.querySelector('span, i, svg, img, button, a, [class*="icon"], [onclick]');
      if (leaf) target = leaf;
    }

    target.focus();
    var rect = target.getBoundingClientRect();
    // 如果内层元素不可见或大小为0，回退到外层按钮
    if (rect.width === 0 || rect.height === 0) {
      target = btn;
      rect = btn.getBoundingClientRect();
      target.focus();
    }
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    target.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y }));
    return true;
  };

  // Listen for trigger-copy from content script
  window.addEventListener('message', function(e) {
    if (e.data && e.data.source === 'cc-capture-hook' && e.data.type === 'trigger-copy') {
      console.log('[CC-Hook] received trigger-copy', e.data.selector);
      var selector = e.data.selector || 'button[data-testid="copy-turn-action-button"]';

      // 从选择器中提取 data-testid 作用域，精确定位到对应 turn 的操作栏第一个 button
      var testidMatch = selector.match(/\[data-testid="([^"]+)"\]/);
      if (testidMatch) {
        var turn = document.querySelector('[data-testid="' + testidMatch[1] + '"]');
        if (turn) {
          var actionBar = turn.querySelector('[data-foundation-type="receive-message-action-bar"]');
          if (actionBar) {
            var btns = actionBar.querySelectorAll('button');
            if (btns.length > 0) {
              console.log('[CC-Hook] btn found via turn scoping');
              window.__ccSimulateCopy(btns[0]);
              return;
            }
          }
        }
      }

      // 兜底1：原始作用域选择器（找一次）
      var btn = document.querySelector(selector);
      if (btn) { console.log('[CC-Hook] btn found via direct selector'); window.__ccSimulateCopy(btn); return; }

      // 兜底2：去掉 data-testid 作用域，全局取最后一个匹配按钮
      // 适用场景：Gemini、豆包等平台的复制按钮在 turn 容器外部
      var unscopedMatch = selector.replace(/\[data-testid="[^"]+"\]\s*/, '');
      if (unscopedMatch !== selector) {
        var all = document.querySelectorAll(unscopedMatch);
        var lastBtn = all[all.length - 1] || null;
        if (lastBtn) { console.log('[CC-Hook] btn found via unscoped fallback'); window.__ccSimulateCopy(lastBtn); return; }
      }

      console.log('[CC-Hook] btn NOT found');
    }
  });
})();
