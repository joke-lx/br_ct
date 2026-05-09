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

  // Hook copy event (execCommand('copy') path)
  document.addEventListener('copy', function(e) {
    try {
      var text = null, html = null;
      try { text = e.clipboardData.getData('text/plain'); } catch(ex) {}
      try { html = e.clipboardData.getData('text/html'); } catch(ex) {}
      if (text || html) {
        window.postMessage({ source: 'cc-capture-hook', type: 'clipboard-data', payload: { html: html || null, text: text || null, source: 'copy.event' } }, '*');
      }
    } catch(ex) {}
  });

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
      var btn = document.querySelector(e.data.selector || 'button[data-testid="copy-turn-action-button"]');
      if (btn) { console.log('[CC-Hook] btn found, simulating click'); window.__ccSimulateCopy(btn); }
      else { console.log('[CC-Hook] btn NOT found'); }
    }
  });
})();
