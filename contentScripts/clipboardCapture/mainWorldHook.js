(function() {
  if (window.__ccCaptureHook) return;
  window.__ccCaptureHook = true;

  // Capture guard: only intercept when our auto-capture triggers clipboard operations.
  // User-initiated copies (Ctrl+C, right-click, manual click on copy button) are NEVER intercepted.
  // Uses DOM dataset (set by content script synchronously) instead of postMessage (async cross-world).
  function isCaptureActive() { return document.documentElement.dataset.ccCaptureActive === '1'; }

  console.log('[CC-Hook] loaded');

  // Hook clipboard.write at prototype level
  var proto = Object.getPrototypeOf(navigator.clipboard);
  var _origWrite = proto.write;
  var _origWriteText = proto.writeText;
  Object.defineProperty(proto, 'write', {
    value: async function(items) {
      var html = null, text = null;
      for (var i = 0; i < (items || []).length; i++) {
        try { if (items[i].types.includes('text/html')) { var b = await items[i].getType('text/html'); html = await b.text(); } } catch(e) {}
        try { if (items[i].types.includes('text/plain')) { var b = await items[i].getType('text/plain'); text = await b.text(); } } catch(e) {}
      }
      if (isCaptureActive()) {
        window.postMessage({ source: 'cc-capture-hook', type: 'clipboard-data', payload: { html: html || null, text: text || null, source: 'clipboard.write' } }, '*');
        return Promise.resolve();
      }
      return _origWrite.apply(this, arguments);
    },
    configurable: true, writable: true
  });

  // Hook clipboard.writeText
  Object.defineProperty(proto, 'writeText', {
    value: async function(text) {
      if (isCaptureActive()) {
        window.postMessage({ source: 'cc-capture-hook', type: 'clipboard-data', payload: { html: null, text: String(text || ''), source: 'clipboard.writeText' } }, '*');
        return Promise.resolve();
      }
      return _origWriteText.apply(this, arguments);
    },
    configurable: true, writable: true
  });

  // Hook document.execCommand('copy') for platforms (like GLM) that use execCommand + textarea
  // dispatchEvent 没有 transient activation → execCommand 静默失败 → copy event 不会触发
  // 但此时 selection（textarea）已经创建，可以直接读取
  var _origExecCommand = document.execCommand.bind(document);
  document.execCommand = function(command, showUI, value) {
    if (command === 'copy' || command === 'cut') {
      var text = null, html = null;
      var sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        text = sel.toString() || null;
        try {
          var range = sel.getRangeAt(0);
          var div = document.createElement('div');
          div.appendChild(range.cloneContents());
          html = div.innerHTML || null;
        } catch(ex) {}
        // textarea 的 cloneContents 不产生 HTML，用 text 兜底
        if (!html && text) html = text;
      }
      if (text || html) {
        if (isCaptureActive()) {
          window.postMessage({
            source: 'cc-capture-hook',
            type: 'clipboard-data',
            payload: { html: html || null, text: text || null, source: 'execCommand.hook' }
          }, '*');
        }
      }
      // 尝试原始 execCommand（有 transient activation 时成功，没有则静默失败）
      try { return _origExecCommand(command, showUI, value); } catch(e) { return false; }
    }
    return _origExecCommand(command, showUI, value);
  };

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
    // 用 firstElementChild 遍历到第一个叶子元素（避免拿到下拉箭头等附属元素）
    var target = btn;
    var child = target;
    while (child.firstElementChild) {
      var next = child.firstElementChild;
      if (next.tagName && next.tagName.toLowerCase() === 'svg') break;
      child = next;
    }
    target = child;
    if (target === btn) {
      // 无子元素，取常见可交互子元素作为 fallback
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

  // Helper: clean up marker attribute for a markerId
  function cleanMarker(markerId) {
    if (!markerId) return;
    var m = document.querySelector('[data-cc-marker="' + markerId + '"]');
    if (m) m.removeAttribute('data-cc-marker');
  }

  // Listen for trigger-copy from content script
  window.addEventListener('message', function(e) {
    if (e.data && e.data.source === 'cc-capture-hook' && e.data.type === 'trigger-copy') {
      console.log('[CC-Hook] received trigger-copy', e.data.selector);
      var selector = e.data.selector || 'button[data-testid="copy-turn-action-button"]';
      var markerId = e.data.markerId;

      // 路径 A：基于 data-cc-marker 标记的精确定位（content script 在找到的元素上设标记）
      // 避免 CSS 选择器跨域失效的问题（不同 world 的 data-testid 可能不一致）
      if (markerId) {
        var markerEl = document.querySelector('[data-cc-marker="' + markerId + '"]');
        if (markerEl) {
          console.log('[CC-Hook] btn found via marker');
          window.__ccSimulateCopy(markerEl);
          markerEl.removeAttribute('data-cc-marker');
          return;
        }
        // 标记已被清理，继续兜底
      }

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
              cleanMarker(markerId);
              return;
            }
          }
        }
      }

      // 兜底1：原始选择器（找一次）
      var btn = document.querySelector(selector);
      if (btn) {
        // AI Studio 特殊处理：more_vert 只打开菜单，需第二步点击 Copy as text 触发 execCommand
        if (window.location.hostname.indexOf('aistudio.google.com') !== -1) {
          console.log('[CC-Hook] AI Studio two-step: clicking more_vert');
          window.__ccSimulateCopy(btn);
          setTimeout(function() {
            var menuItems = document.querySelectorAll('button.mat-mdc-menu-item');
            for (var i = 0; i < menuItems.length; i++) {
              if (menuItems[i].textContent.indexOf('Copy as text') >= 0) {
                console.log('[CC-Hook] AI Studio two-step: clicking Copy as text');
                window.__ccSimulateCopy(menuItems[i]);
                break;
              }
            }
          }, 500);
          cleanMarker(markerId);
          return;
        }
        console.log('[CC-Hook] btn found via direct selector');
        window.__ccSimulateCopy(btn);
        cleanMarker(markerId);
        return;
      }

      // 兜底2：去掉 data-testid 作用域，全局取最后一个匹配按钮
      var unscopedMatch = selector.replace(/\[data-testid="[^"]+"\]\s*/, '');
      if (unscopedMatch !== selector) {
        var all = document.querySelectorAll(unscopedMatch);
        var lastBtn = all[all.length - 1] || null;
        if (lastBtn) {
          console.log('[CC-Hook] btn found via unscoped fallback');
          window.__ccSimulateCopy(lastBtn);
          cleanMarker(markerId);
          return;
        }
      }

      console.log('[CC-Hook] btn NOT found');
      cleanMarker(markerId);
    }
  });
})();
