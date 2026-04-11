/**
 * BindDom 后台模块
 * 使用 chrome.commands API 处理快捷键
 */

// 导出函数：在当前标签页执行绑定
export function executeBindingOnCurrentTab(tabId, sendResponse) {
  chrome.storage.local.get('binddom.bindings', (result) => {
    const bindings = result['binddom.bindings'] || [];

    // 获取标签页URL
    chrome.tabs.get(tabId, (tab) => {
      if (!tab || !tab.url) {
        sendResponse({ success: false, message: '无法获取标签页' });
        return;
      }

      const currentUrl = tab.url;
      let currentHost = '';
      try {
        currentHost = new URL(currentUrl).hostname.replace('www.', '');
      } catch { }

      // 查找匹配的绑定
      const match = bindings.find(b => {
        try {
          const bHost = new URL(b.url).hostname.replace('www.', '');
          return bHost === currentHost || currentUrl.includes(b.url);
        } catch { return false; }
      });

      if (!match) {
        sendResponse({ success: false, message: '没有匹配的绑定' });
        return;
      }

      // 注入执行脚本
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['funcs/inject_mod/binddom_execute.js']
      }, (results) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, message: chrome.runtime.lastError.message });
          return;
        }

        // 发送选择器数据给注入的脚本
        chrome.tabs.sendMessage(tabId, {
          action: 'binddom.doClick',
          selector: match.selector
        }, (response) => {
          sendResponse(response || { success: false, message: '执行失败' });
        }).catch(err => {
          sendResponse({ success: false, message: err.message });
        });
      });
    });
  });
}

// 导出函数：处理 elementPicked 消息
export function handleElementPicked(request, sendResponse) {
  console.log('[BindDom] 收到选择器:', request.selector, 'URL:', request.url);

  const pendingData = {
    selector: request.selector,
    url: request.url,
    timestamp: Date.now()
  };

  chrome.storage.local.set({ 'binddom.pending': pendingData }, () => {
    if (chrome.runtime.lastError) {
      console.error('[BindDom] 存储失败:', chrome.runtime.lastError.message);
    } else {
      console.log('[BindDom] 已存储到 pending');
    }
  });

  sendResponse({ status: 'ok' });
  return true;
}

// 导出函数：处理 addBinding 消息
export function handleAddBinding(request, sendResponse) {
  console.log('[BindDom] 添加绑定:', request);

  chrome.storage.local.get('binddom.bindings', (result) => {
    const bindings = result['binddom.bindings'] || [];

    bindings.push({
      url: request.url,
      selector: request.selector,
      desc: request.desc || '',
      timestamp: Date.now()
    });

    chrome.storage.local.set({ 'binddom.bindings': bindings }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('[BindDom] 绑定已保存，共', bindings.length, '条');
        sendResponse({ success: true, count: bindings.length });
      }
    });
  });

  return true; // 保持消息通道
}

// 设置 BindDom 相关命令监听
export function setupBinddomCommandListener() {
  chrome.commands.onCommand.addListener((command) => {
    console.log('[BindDom] 命令触发:', command);

    if (command === 'binddom_execute') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0 || !tabs[0]) {
          console.log('[BindDom] 未找到活跃标签页');
          return;
        }
        executeBindingOnCurrentTab(tabs[0].id, (response) => {
          console.log('[BindDom] 执行结果:', response);
        });
      });
    }
  });
}

// 设置 BindDom 消息监听
export function setupBinddomMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[BindDom] 收到消息:', request.action, 'from:', sender.tab?.url || 'background');

    if (request.action === 'binddom.elementPicked') {
      return handleElementPicked(request, sendResponse);
    }

    if (request.action === 'binddom.addBinding') {
      return handleAddBinding(request, sendResponse);
    }

    if (request.action === 'binddom.executeClick') {
      // popup 触发的执行
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
          sendResponse({ success: false, message: '未找到活跃标签页' });
          return;
        }
        executeBindingOnCurrentTab(tabs[0].id, sendResponse);
      });
      return true;
    }

    return false;
  });
}
