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
  window.__ccSimulateCopy = function(btn) {
    if (!(btn instanceof Element)) return false;
    console.log('[CC-Hook] simulateCopy click', btn);
    btn.click();
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

      // 兜底：直接使用原始选择器
      var btn = document.querySelector(selector);
      if (btn) { console.log('[CC-Hook] btn found, simulating click'); window.__ccSimulateCopy(btn); }
      else { console.log('[CC-Hook] btn NOT found'); }
    }
  });
})();
